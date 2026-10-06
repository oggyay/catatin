# Tutorial 3: Mencoba Bot WhatsApp Tanpa Gateway

> Kuadran: **Tutorial** — pelajaran step-by-step memakai bot WhatsApp lewat curl ke webhook lokal. Tidak butuh akun WhatsApp atau gateway.

Setelah tutorial ini Anda akan tahu:
- Cara simulasi pesan WhatsApp masuk lewat curl.
- Cara cek saldo, cek pengeluaran, dan input transaksi via "WhatsApp".
- Cara konfirmasi atau batalkan transaksi pending.
- Tempat melihat history percakapan bot di DB.

Prasyarat:
- [Tutorial 1](./01-jalankan-lokal.md) selesai.
- Bot terhubung ke akun demo: tenant "Demo UMKM" dengan owner WA `6281234567890`. Plan harus mendukung WhatsApp bot (basic atau pro).

> Jika dashboard menampilkan plan **free**, upgrade dulu untuk testing:
>
> ```sql
> UPDATE "Tenant" SET "subscriptionPlan" = 'basic' WHERE name = 'Demo UMKM';
> ```

Estimasi waktu: 10 menit.

## Setup terminal

Sebaiknya buka 2 terminal:
- **Terminal A**: backend yang sudah jalan (`npm run dev`). Biarkan terbuka.
- **Terminal B**: untuk curl.

## Langkah 1 — Cek saldo

Di terminal B:

```bash
curl -X POST http://localhost:4000/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"from":"6281234567890","body":"saldo"}'
```

Response: `{"ok":true}` (instant).

Lihat terminal A. Bot membalas (mode mock):

```
================ [MOCK WA SEND] ================
To     : 6281234567890
Message: Saldo Anda saat ini:

Total: Rp700.000

Kas Tunai: Rp700.000
BCA: Rp500.000
================================================
```

Saldo di sini akan tergantung apa yang Anda lakukan di Tutorial 2.

## Langkah 2 — Cek pengeluaran bulan ini

```bash
curl -X POST http://localhost:4000/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"from":"6281234567890","body":"pengeluaran bulan ini"}'
```

Bot membalas dengan total pengeluaran + 5 kategori terbesar.

## Langkah 3 — Catat pengeluaran (alur konfirmasi)

```bash
curl -X POST http://localhost:4000/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"from":"6281234567890","body":"keluar 50rb makan siang"}'
```

Bot di terminal A:

```
Konfirmasi pengeluaran:

Nominal: Rp50.000
Kategori: Makan
Akun: Kas Tunai
Tanggal: 26 Mei 2026
Keterangan: keluar 50rb makan siang

Balas YA untuk simpan, atau BATAL untuk membatalkan.
```

> **Apa yang terjadi?**
> Parser membaca: `intent=input_pengeluaran`, `amount=50000` (dari `50rb`), `categoryName=Makan` (mapping `makan` → kategori "Makan"), `accountId=null` (tidak disebut). Bot pilih akun default (`Kas Tunai`).

Sekarang konfirmasi:

```bash
curl -X POST http://localhost:4000/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"from":"6281234567890","body":"ya"}'
```

Bot:

```
Pengeluaran berhasil disimpan.
Saldo Kas Tunai sekarang: Rp650.000
```

Cek di web dashboard — entri baru muncul dengan **source = whatsapp**.

## Langkah 4 — Catat pemasukan dengan periode

```bash
curl -X POST http://localhost:4000/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"from":"6281234567890","body":"jualan 250rb kemarin"}'
```

Parser akan deteksi:
- `intent=input_pemasukan` (dari verba `jualan` + nominal).
- `amount=250000`.
- `category=Penjualan` (mapping `jualan`).
- `date=kemarin` → tanggal kemarin.

Konfirmasi dengan `ya`:

```bash
curl -X POST http://localhost:4000/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"from":"6281234567890","body":"ya"}'
```

## Langkah 5 — Batalkan transaksi pending

Buat pending dulu:

```bash
curl -X POST http://localhost:4000/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"from":"6281234567890","body":"bayar 100rb sewa"}'
```

Lalu batalkan:

```bash
curl -X POST http://localhost:4000/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"from":"6281234567890","body":"batal"}'
```

Bot: `Transaksi dibatalkan.`

Tidak ada perubahan saldo. Cek `WhatsappPendingTransaction` — entri akan ber-status `cancelled`.

## Langkah 6 — Transfer antar akun

```bash
curl -X POST http://localhost:4000/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"from":"6281234567890","body":"transfer Kas Tunai ke BCA 100rb"}'
```

Bot:

```
Konfirmasi transfer:

Nominal: Rp100.000
Dari: Kas Tunai
Ke: BCA
Tanggal: 26 Mei 2026
Keterangan: transfer Kas Tunai ke BCA 100rb

Balas YA untuk simpan, atau BATAL untuk membatalkan.
```

Konfirmasi YA → kedua saldo terupdate.

## Langkah 7 — Cek help

```bash
curl -X POST http://localhost:4000/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"from":"6281234567890","body":"help"}'
```

Bot mengirim daftar contoh command yang bisa dipakai. Lihat juga [Reference: WA grammar](../reference/wa-command-grammar.md) untuk daftar pola lengkap.

## Langkah 8 — Inspeksi log

Buka DB client (psql, TablePlus, dll) dan cek `WhatsappLog`:

```sql
SELECT direction, intent, message, "createdAt"
FROM "WhatsappLog"
WHERE "whatsappNumber" = '6281234567890'
ORDER BY "createdAt" DESC
LIMIT 20;
```

Anda akan melihat semua pesan dwi-arah. Untuk inbound, kolom `meta` (JSON) berisi hasil parser:

```sql
SELECT message, intent, meta::text
FROM "WhatsappLog"
WHERE direction = 'inbound' AND intent IS NOT NULL
ORDER BY "createdAt" DESC
LIMIT 5;
```

Output meta akan mirip:

```json
{
  "intent": "input_pengeluaran",
  "entities": {
    "amount": 50000,
    "categoryName": "Makan",
    "accountName": null,
    "description": "makan siang",
    "date": null,
    "period": null
  },
  "confidence": "high",
  "source": "heuristic"
}
```

## Yang baru saja Anda pelajari

- Webhook menerima payload sederhana `{ from, body }`.
- Parser memahami varian nominal (`50rb`, `250rb`), tanggal Indonesia (`kemarin`), dan mapping kategori (`jualan` → Penjualan).
- Alur konfirmasi pending mencegah salah simpan.
- Semua aktivitas tercatat di `WhatsappLog` + `WhatsappPendingTransaction`.

## Apa berikutnya

- [Tutorial 4: jelajahi admin platform](./04-jelajahi-admin-platform.md).
- [WA command grammar](../reference/wa-command-grammar.md) — eksplorasi pola perintah.
- [WhatsApp bot](../explanation/06-whatsapp-bot.md) — penjelasan alur lengkap.
- [How-to: tambah intent baru](../how-to/tambah-intent-whatsapp.md).
