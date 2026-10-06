# Tata Bahasa Command WhatsApp

> Kuadran: **Reference** — daftar lengkap pola pesan yang dimengerti parser. Source: `backend/src/services/whatsapp/parser.js`.

Untuk diskusi strategi dua-tingkat (heuristic + OpenAI), lihat [AI parser](../explanation/07-ai-parser.md). Dokumen ini fokus ke fakta: pola apa yang valid dan apa yang dihasilkan.

## Variasi nominal

`parseNominal` mengenali pola berikut (case-insensitive):

| Input | Hasil |
| --- | --- |
| `50000`, `Rp50000`, `Rp 50.000` | 50000 |
| `2.500.000` | 2500000 (titik thousand-separator) |
| `50rb`, `50 rb`, `50ribu`, `50 ribu` | 50000 |
| `50k`, `50 k` | 50000 |
| `1jt`, `1 jt`, `1juta`, `1 juta` | 1000000 |
| `2,5 juta`, `2.5jt` | 2500000 |
| `250rb` di tengah kalimat | 250000 |

Tidak dikenali:
- Mata uang lain (`USD`, `$`).
- Desimal halus (`50.000,5`) — koma dianggap pemisah desimal di koma-mode, tidak diharapkan.
- Operasi aritmatika (`3 × 50rb`).

## Variasi periode (label)

`detectPeriod` mengembalikan salah satu: `today`, `yesterday`, `this_week`, `last_week`, `this_month`, `last_month`, `this_year`, atau null.

| Input | Hasil |
| --- | --- |
| `hari ini`, `hr ini`, `today` | `today` |
| `kemarin`, `kmrn`, `yesterday` | `yesterday` |
| `minggu ini` | `this_week` |
| `minggu lalu` | `last_week` |
| `bulan ini` | `this_month` |
| `bulan lalu` | `last_month` |
| `tahun ini` | `this_year` |

## Variasi tanggal (`parseIndonesianDate`)

Selain label periode, parser bisa mengekstrak **tanggal absolut** ke `YYYY-MM-DD`:

| Input | Hasil |
| --- | --- |
| `hari ini`, `hr ini`, `today` | tanggal hari ini |
| `kemarin`, `kmrn`, `yesterday` | tanggal kemarin |
| `tadi pagi/siang/sore/malam` | tanggal hari ini (confidence medium) |
| `2026-05-10` | 2026-05-10 |
| `10/05/2026`, `10-05-26`, `10.5.2026` | 2026-05-10 |
| `tanggal 10`, `tgl 10` | bulan & tahun saat ini |
| `10 Mei`, `10 Mei 2026` | sesuai (jangka pendek bulan: Jan/Feb/Mar/Apr/Mei/Jun/Jul/Agu/Agt/Sep/Okt/Nov/Des) |

Tanggal hasil heuristic **tidak** akan ditimpa oleh hasil OpenAI.

## Intent + contoh perintah

### `cek_saldo`

```
saldo
cek saldo
berapa saldo
saldo bca           # nama akun di-detect → balasan menampilkan akun spesifik
```

Output bot: total saldo + per akun aktif. Jika nama akun spesifik dikenali, hanya saldo akun itu yang dikirim. Akun `hutang` dan `piutang` tidak ditampilkan di daftar saldo umum jika saldonya 0.

### `cek_pengeluaran`

```
pengeluaran
pengeluaran hari ini
pengeluaran bulan ini
pengeluaran minggu lalu
pengeluaran kategori makan       # opsional, kalau parser kenali kategori
```

Tidak boleh disertai nominal. Output: total pengeluaran + top 5 kategori dalam range periode.

### `cek_pemasukan`

```
pemasukan
pemasukan hari ini
pemasukan bulan ini
```

Output: total pemasukan + top 5 kategori.

### `riwayat_transaksi`

```
riwayat
riwayat hari ini
riwayat bulan ini
transaksi terakhir 10
riwayat pengeluaran hari ini
riwayat pemasukan bulan ini
mutasi hari ini
```

Output: daftar transaksi aktif terbaru dalam periode yang diminta. Default periode adalah `hari ini`, default jumlah adalah 5 transaksi, dan limit maksimal adalah 10 transaksi. Riwayat umum menampilkan `income`, `expense`, dan `adjustment`; filter `pengeluaran` hanya menampilkan `expense`, filter `pemasukan` hanya menampilkan `income`.

### `input_pengeluaran`

Kombinasi verba + nominal + (opsional) keterangan + (opsional) tanggal/akun/kategori.

```
keluar 50000 makan siang
keluar 50rb makan siang
bayar 25k parkir
beli 100rb beras
catat pengeluaran 75rb listrik
50rb makan kemarin               # tanpa verba; jatuh ke fallback heuristic
```

Verba expense yang dikenali: `keluar, kluar, pengeluaran, pngeluaran, bayar, beli, belanja, catat pengeluaran`.

Output: pesan konfirmasi + create `WhatsappPendingTransaction`. User balas `YA` untuk simpan.

### `input_pemasukan`

```
masuk 250000 jualan
masuk 250rb jualan
terima 1jt proyek
dapat 500rb gaji
gajian 5 juta hari ini
jualan 2,5jt
```

Verba income: `masuk, pemasukan, pemasukn, msuk, terima, dapat, gajian, jual, jualan`.

### `transfer_akun`

```
transfer Bank A ke Kas 50rb
transfer dari Bank A ke Kas 50rb
pindah 100rb Bank A Kas
mutasi 200rb BCA ke Dana
tarik tunai BCA 500rb            # auto-detect akun kas tujuan kalau hanya 1
tarik tunai BCA Kas C 500rb      # multi-cash → wajib sebut tujuan
setor tunai BCA 500rb            # asumsi dari kas (default)
setor tunai Kas C BCA 500rb
tf 100rb dari mandiri ke gopay
```

Verba transfer: `transfer, tf, pindah, mindahin, mutasi, tarik tunai, setor tunai`.

Pola yang di-detect untuk akun:
- `dari A ke B` / `from A to B`
- `pindah A B` (urutan A=from, B=to)
- Untuk `tarik tunai X` dengan satu akun cash di tenant → auto-pick cash sebagai tujuan.
- Untuk `setor tunai X` dengan satu akun cash → auto-pick cash sebagai sumber.

Jika tidak jelas (nama akun tidak match, multi-cash, dll), bot membalas dengan daftar akun aktif dan minta klarifikasi.

### Hutang & piutang

Hutang/piutang saat ini bersifat global per tenant lewat akun khusus `hutang` dan `piutang`, belum per kontak/orang.

```
hutang
cek hutang
piutang
cek piutang
catat hutang 500rb dari BCA
bayar hutang 200rb dari BCA
catat piutang 300rb ke BCA
terima piutang 300rb ke BCA
```

Output `cek hutang` / `cek piutang`: saldo akun hutang/piutang saat ini. Command catat/bayar hutang dan catat/terima piutang membuat pending transaksi yang perlu dikonfirmasi dengan `YA`, sama seperti input transaksi biasa.

### `konfirmasi`

Memicu eksekusi pending transaksi.

```
ya
y
ok
oke
iya
setuju
konfirm
konfirmasi
```

### `batal`

Membatalkan pending transaksi.

```
batal
cancel
tidak
nggak
ngga
gak
no
n
```

### `help`

Mengirim daftar contoh command (lihat `sendHelp` di `whatsapp-bot.service.js:621-661`).

```
help
bantuan
menu
perintah
/help
```

### `unknown`

Apapun yang tidak masuk pola di atas. Bot membalas dengan help message diawali "Saya tidak mengerti perintah tersebut".

## Catatan pesan grup WAHA

Webhook mendukung pesan grup WAHA jika payload berisi `chatId` grup (`@g.us`) dan participant pengirim (`author`, `participant`, `_data.author`, `_data.participant`, atau `key.participant`). Bot mencari user dari participant, membalas ke `chatId` grup, dan mengirim `sendSeen` secara best-effort dengan `chatId` grup + `messageIds` pesan grup.

## Mapping kategori heuristic

Saat user tidak menyebut nama kategori eksplisit, parser memetakan kata-kata umum ke nama kategori bawaan:

| Kata di pesan | Kategori target |
| --- | --- |
| `makan`, `jajan`, `kopi`, `warung` | Makan |
| `bensin`, `grab`, `gojek`, `ojek` | Transportasi |
| `belanja`, `market` | Belanja |
| `listrik`, `pln` | Listrik |
| `internet`, `wifi`, `indihome` | Internet |
| `sewa`, `kontrakan` | Sewa |
| `gaji`, `salary` | Gaji (income) / "Gaji Karyawan" tidak dipetakan otomatis |
| `jual`, `jualan`, `penjualan` | Penjualan |
| `bonus` | Bonus |
| `modal` | Modal |

Mapping hanya berhasil jika tenant punya kategori dengan nama tersebut. Tenant baru sudah punya semua nama ini lewat seed default — lihat `backend/src/config/defaults.js`.

## Command khusus link

Selain intent parser, ada perintah eksklusif untuk linking WhatsApp:

```
link CATATIN-123456
```

Format `CATATIN-XXXXXX` (6 digit). Diproses oleh `handleLinkToken`. Lihat [Otentikasi & OTP](../explanation/05-otentikasi-otp.md#hubungkan-whatsapp-ke-akun-link-flow).

Untuk link-request flow, balasan `YA` / `BATAL` akan memicu `handleLinkRequestReply` jika ada `WhatsappLinkRequest` aktif.

## Pesan yang tidak dilayani

- Pesan dari group chat (`@g.us`) → diabaikan.
- Pesan dari diri sendiri (`fromMe=true`) → diabaikan.
- Pesan kosong → diabaikan.
- Pesan dari nomor tidak terdaftar → balasan "WhatsApp belum terhubung".
- Pesan dari user di plan `free` → balasan "Fitur WhatsApp tersedia mulai plan Basic".

## Lanjut baca

- [WhatsApp bot](../explanation/06-whatsapp-bot.md).
- [AI parser](../explanation/07-ai-parser.md).
- [How-to: tambah intent baru](../how-to/tambah-intent-whatsapp.md).
