# Tutorial 2: Membuat Transaksi Pertama Lewat Web

> Kuadran: **Tutorial** — pelajaran end-to-end mencatat pemasukan & pengeluaran lewat UI web, lihat efeknya di dashboard, dan hapus dengan benar (void).

Setelah tutorial ini Anda akan tahu:
- Cara mencatat pemasukan dan pengeluaran lewat form.
- Cara membuat akun baru dan menjadikannya default.
- Cara melihat saldo + ringkasan dashboard.
- Cara membatalkan transaksi (void).

Prasyarat: sudah menyelesaikan [Tutorial 1](./01-jalankan-lokal.md).

Estimasi waktu: 10 menit.

## Skenario

Anda adalah pemilik warung. Hari ini Anda:
1. Setor modal awal Rp1.000.000 ke kas.
2. Catat pengeluaran Rp50.000 untuk beli bahan.
3. Dapat Rp200.000 hasil jualan.
4. Sadar pengeluaran salah, batalkan.
5. Pindah Rp500.000 dari Kas ke BCA.

## Langkah 1 — Login

Login dengan nomor `6281234567890` (sudah di-seed). OTP di terminal backend.

## Langkah 2 — Tambah akun BCA

Sebelum lanjut, kita siapkan akun bank.

1. Klik menu **Akun** di sidebar.
2. Klik tombol **+ Tambah Akun**.
3. Isi:
   - Nama: `BCA`.
   - Tipe: **Bank**.
   - Saldo awal: `0`.
   - Default: ☐ (biarkan kosong, kas tetap default).
4. Klik **Simpan**.

Sekarang Anda punya 2 akun: `Kas Tunai` (default) dan `BCA`.

## Langkah 3 — Catat modal awal Rp1.000.000

Skenario ini sebetulnya **bukan transaksi** — ini saldo awal. Cara terbaik adalah set saldo awal saat pembuatan akun. Karena sudah terlanjur dibuat dengan saldo 0, kita pakai fitur **Penyesuaian Saldo**:

1. Buka halaman **Akun**.
2. Klik akun **Kas Tunai**, klik **Sesuaikan Saldo** (ikon edit).
3. Isi:
   - Saldo riil: `1000000`.
   - Alasan: "Modal awal".
4. Klik **Simpan**.

Akan dibuat transaksi `adjustment` dengan amount `Rp1.000.000`, dan saldo Kas Tunai jadi `Rp1.000.000`.

> **Mengapa pakai penyesuaian, bukan pemasukan?**
> Pemasukan/pengeluaran adalah aliran kas dari sumber/ke pihak luar. Penyesuaian saldo adalah koreksi internal (mis. saldo bank di rekening koran beda dengan catatan). Lihat [Domain keuangan](../explanation/04-domain-keuangan.md#invariant-4--penyesuaian-saldo-bukan-sekadar-update-angka).

## Langkah 4 — Catat pengeluaran beli bahan

1. Klik tombol **+ Tambah Transaksi** di sidebar atau dashboard.
2. Isi:
   - Tipe: **Pengeluaran**.
   - Akun: **Kas Tunai**.
   - Kategori: **Belanja** (atau **Operasional**, pilih yang sesuai).
   - Nominal: `50000`.
   - Keterangan: "beli bahan".
   - Tanggal: hari ini.
3. Klik **Simpan**.

Saldo Kas Tunai sekarang `Rp950.000`.

## Langkah 5 — Catat pemasukan jualan

1. Klik **+ Tambah Transaksi**.
2. Isi:
   - Tipe: **Pemasukan**.
   - Akun: **Kas Tunai**.
   - Kategori: **Penjualan**.
   - Nominal: `200000`.
   - Keterangan: "hasil jualan hari ini".
3. Klik **Simpan**.

Saldo Kas Tunai sekarang `Rp1.150.000`.

## Langkah 6 — Lihat dashboard

Klik menu **Dashboard**. Anda akan melihat:

- **Total Saldo**: Rp1.150.000 (semua akun).
- **Pemasukan Bulan ini**: Rp200.000.
- **Pengeluaran Bulan ini**: Rp50.000.
- **Net Cashflow**: Rp150.000.
- **Top Kategori** dengan breakdown bar.
- **Transaksi Terbaru**: 3 entri (modal awal, beli bahan, jualan).

## Langkah 7 — Batalkan transaksi salah (void)

Misalnya pengeluaran "beli bahan" sebenarnya tidak terjadi.

1. Klik menu **Transaksi**.
2. Cari entri "beli bahan", klik tombol **Void** di kanan baris.
3. Konfirmasi.

Saldo Kas Tunai naik kembali ke `Rp1.200.000`. Transaksi tidak hilang dari list — statusnya berubah ke `void` (badge merah). Ini sengaja, untuk jaga audit trail.

## Langkah 8 — Transfer antar akun

1. Klik menu **Transaksi**, lalu tombol **↔ Transfer Antar Akun** (atau **+ Transfer** di sidebar).
2. Isi:
   - Dari akun: **Kas Tunai**.
   - Ke akun: **BCA**.
   - Nominal: `500000`.
   - Keterangan: "setor ke bank".
3. Klik **Simpan Transfer**.

Hasil:
- Saldo Kas Tunai: `Rp700.000`.
- Saldo BCA: `Rp500.000`.

Cek menu **Transaksi**. Transfer ditampilkan sebagai **satu baris** "Transfer Kas Tunai → BCA" dengan badge `transfer`. Sebenarnya di database ada dua record (out + in) yang dikelompokkan oleh `transferGroupId`.

## Langkah 9 — Filter transaksi

Coba fitur filter di halaman **Transaksi**:

- Filter **Akun = BCA** → hanya transfer in di BCA muncul (plus pasangan out untuk konteks).
- Filter **Tipe = Pemasukan** → hanya pemasukan + sisi in transfer.
- Filter **Sumber = web** → semua dari UI.
- Filter **Tanggal Dari** = hari ini.

## Langkah 10 — Cek laporan cashflow

Klik menu **Laporan**.

- Pilih periode **Bulan ini**.
- Lihat **Total Pemasukan**, **Total Pengeluaran**, **Net Cashflow**.
- Klik **Download Excel** untuk export.

Buka file `.xlsx` yang ter-download. Anda akan melihat 5 sheet:
1. Ringkasan
2. Pemasukan per Kategori
3. Pengeluaran per Kategori
4. Per Akun
5. Transaksi (raw list)

## Yang baru saja Anda pelajari

- Penyesuaian saldo vs transaksi.
- Buat akun + set default.
- Tambah transaksi income/expense.
- Filter & pagination transaksi.
- Transfer antar akun (sepasang transaksi).
- Void (bukan delete).
- Dashboard KPI + breakdown kategori.
- Export laporan Excel.

## Apa berikutnya

- [Tutorial 3: bot WhatsApp dengan mock](./03-coba-bot-whatsapp-mock.md) — pelajari command yang sama lewat chat.
- [Reference: API transactions](../reference/api/transactions.md) — kalau ingin pakai dari mobile/integrator.
- [Domain keuangan](../explanation/04-domain-keuangan.md) — kenapa transfer bukan satu transaksi tapi dua.
