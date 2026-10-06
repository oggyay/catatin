# Dokumentasi CatatIN

Dokumentasi proyek CatatIN disusun mengikuti kerangka [Diátaxis](https://diataxis.fr/) yang membagi dokumentasi ke dalam **empat kuadran** berdasarkan tujuan pembaca. Pakai panduan di bawah untuk memilih dokumen yang paling relevan.

## Cara membaca dokumen ini

| Tujuan Anda | Buka folder | Karakter |
| --- | --- | --- |
| Belajar dari nol, ingin "ikut praktik" | [`tutorials/`](./tutorials) | Pelajaran berurut, hasil pasti, ramah pemula |
| Menyelesaikan tugas tertentu | [`how-to/`](./how-to) | Resep praktis, asumsikan sudah tahu konteks |
| Mencari fakta detail (endpoint, field, env) | [`reference/`](./reference) | Kering, lengkap, mudah dicari |
| Memahami "kenapa", buat redesign / arsitektur | [`explanation/`](./explanation) | Diskursif, menjelaskan trade-off |

Jika Anda baru bergabung, mulai dengan tutorial **[01-jalankan-lokal](./tutorials/01-jalankan-lokal.md)**, lalu lompat ke explanation **[01-overview-produk](./explanation/01-overview-produk.md)** untuk gambaran utuh.

## Daftar isi

### Tutorials — Belajar
1. [Jalankan CatatIN di lokal](./tutorials/01-jalankan-lokal.md)
2. [Membuat transaksi pertama lewat web](./tutorials/02-buat-transaksi-pertama.md)
3. [Mencoba bot WhatsApp tanpa gateway](./tutorials/03-coba-bot-whatsapp-mock.md)
4. [Menjelajahi admin platform](./tutorials/04-jelajahi-admin-platform.md)

### How-to — Menyelesaikan tugas
- [Tambah endpoint API baru](./how-to/tambah-endpoint-api.md)
- [Tambah tabel atau kolom Prisma](./how-to/tambah-tabel-prisma.md)
- [Tambah intent WhatsApp baru](./how-to/tambah-intent-whatsapp.md)
- [Tambah provider WhatsApp baru](./how-to/tambah-provider-whatsapp.md)
- [Tambah halaman frontend baru](./how-to/tambah-halaman-frontend.md)
- [Tambah laporan & export Excel](./how-to/tambah-laporan-export.md)
- [Debug bot WhatsApp tanpa gateway](./how-to/debug-bot-tanpa-gateway.md)
- [Rollback migrasi database](./how-to/rollback-migrasi.md)
- [Deploy ke produksi](./how-to/deploy-produksi.md)

### Reference — Mencari fakta
- [Struktur repo](./reference/struktur-repo.md)
- [Variabel environment](./reference/env-variables.md)
- [Skema database](./reference/database-schema.md)
- [Frontend routes & guard](./reference/frontend-routes.md)
- [Frontend komponen reusable](./reference/frontend-komponen.md)
- [Struktur aplikasi mobile](./reference/mobile-struktur.md)
- [Tata bahasa command WhatsApp](./reference/wa-command-grammar.md)
- [Daftar kode error](./reference/error-codes.md)
- [Role & izin](./reference/permissions-roles.md)
- API per domain
  - [Auth](./reference/api/auth.md)
  - [Dashboard](./reference/api/dashboard.md)
  - [Accounts](./reference/api/accounts.md)
  - [Categories](./reference/api/categories.md)
  - [Transactions](./reference/api/transactions.md)
  - [Reports](./reference/api/reports.md)
  - [Settings](./reference/api/settings.md)
  - [Admin](./reference/api/admin.md)
  - [Webhooks](./reference/api/webhooks.md)

### Explanation — Memahami konsep
1. [Overview produk & persona](./explanation/01-overview-produk.md)
2. [Arsitektur sistem](./explanation/02-arsitektur-sistem.md)
3. [Model multi-tenant](./explanation/03-model-multitenant.md)
4. [Domain keuangan](./explanation/04-domain-keuangan.md)
5. [Otentikasi & OTP WhatsApp](./explanation/05-otentikasi-otp.md)
6. [WhatsApp bot](./explanation/06-whatsapp-bot.md)
7. [AI command parser](./explanation/07-ai-parser.md)
8. [Adapter provider WhatsApp](./explanation/08-adapter-wa-provider.md)
9. [Keputusan arsitektur (ADR ringkas)](./explanation/09-keputusan-arsitektur.md)

### Pelengkap
- [PRD ringkas (rekonstruksi dari kode)](./prd-ringkas.md)
- [Roadmap](./roadmap.md)
- [Glosarium](./glossary.md)

## Status dokumen

Dokumentasi ini ditulis berdasarkan source code revisi terakhir di branch utama (mencakup migrasi sampai `20260603111800_add_hutang_piutang`). Jika Anda menambahkan fitur baru, perbarui dokumen yang relevan; lihat [how-to](./how-to) untuk pola umum.
