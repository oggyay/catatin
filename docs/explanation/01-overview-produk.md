# 1. Overview Produk & Persona

> Kuadran: **Explanation** — bertujuan membantu Anda memahami "apa" dan "untuk siapa" CatatIN, bukan "bagaimana cara memakai".

## Apa itu CatatIN

CatatIN adalah aplikasi pencatatan keuangan sederhana berbasis web dengan dukungan **bot WhatsApp**. Tujuannya adalah membuat pencatatan transaksi—pemasukan, pengeluaran, transfer antar akun—semudah mengirim chat. Pengguna bisa:

- mencatat transaksi lewat web (`/transactions/new`) atau lewat chat WhatsApp,
- melihat saldo per akun, ringkasan bulanan, dan laporan cashflow,
- mengelola beberapa "tenant" (entitas keuangan) dalam satu identitas akun (misal: tenant pribadi + tenant UMKM),
- mengekspor laporan ke Excel multi-sheet.

CatatIN sengaja **tidak mencoba menjadi software akuntansi penuh**. Tidak ada konsep jurnal ganda, hutang/piutang, faktur, atau stok. Skopnya adalah pencatatan kas dasar (single-entry) yang ringan dan cepat dipakai.

## Persona target

Aplikasi ini dirancang untuk dua persona utama. Kode sumber merefleksikan ini lewat enum `TenantType` (`personal` | `umkm`) dan copy berbeda di dashboard (lihat `frontend/src/pages/Dashboard.jsx`).

### Persona 1 — "Pemilik UMKM" (default)
- Menjalankan warung, toko online, jasa kecil, atau usaha keluarga.
- Tidak punya bagian keuangan formal.
- Butuh: tahu kas masuk-keluar harian, omzet bulanan, kategori biaya terbesar.
- Friction yang dihindari: download app baru, install software, pakai komputer khusus. Karena itu input via WhatsApp jadi fitur utama.

### Persona 2 — "Pribadi"
- Individu yang ingin tahu kemana uangnya pergi.
- Sering punya beberapa kantong (kas, BCA, Dana, GoPay).
- Butuh: catat cepat saat baru transaksi, lihat tren bulanan.
- Tidak butuh fitur multi-user atau peran kompleks.

Perbedaan kedua persona muncul di tiga tempat:
1. **Plan limits** (`backend/src/config/plans.js`) — UMKM dapat lebih banyak user & akun di plan Pro.
2. **Copy text** dashboard — UMKM melihat "Omzet" dan "Laba", personal melihat "Pemasukan" dan "Sisa Arus Kas".
3. **Tenant rules** — satu identitas hanya boleh punya **satu** tenant `personal`, tetapi boleh banyak tenant `umkm` (lihat `auth.routes.js:393-405`).

## Persona pendukung

- **Owner / Admin / Member tenant** — peran di dalam satu tenant (lihat [Role & izin](../reference/permissions-roles.md)).
- **Platform admin** — tim CatatIN yang mengelola seluruh tenant, melihat usage, mengaktifkan paket berbayar.

## Value proposition (mengapa ada CatatIN)

| Masalah pengguna | Solusi CatatIN |
| --- | --- |
| "Saya males buka aplikasi catatan, akhirnya lupa nyatat." | Cukup chat WhatsApp `keluar 50rb makan siang` → bot konfirmasi → ketik `YA`. |
| "Aplikasi lain terlalu rumit, banyak fitur akuntansi yang tidak saya butuhkan." | Hanya 5 menu utama: Dashboard, Transaksi, Akun, Kategori, Laporan. |
| "Saya pengen lihat ringkasan cepat, bukan baca laporan keuangan formal." | Dashboard menampilkan KPI total saldo, omzet, biaya, net cashflow + breakdown kategori. |
| "Saya punya kas pribadi dan kas usaha, tapi pakai HP yang sama." | Multi-tenant per identitas: 1 nomor WA bisa switch antara tenant pribadi & UMKM. |

## Apa yang **bukan** CatatIN

Penting dipahami sebelum redesign atau menambah fitur:

- **Bukan software akuntansi formal.** Tidak ada chart of accounts, jurnal, neraca, laba-rugi formal. Cashflow yang ada adalah ringkasan pemasukan dikurangi pengeluaran per periode.
- **Bukan e-wallet atau payment processor.** Tidak ada integrasi pembayaran, tidak menyimpan saldo riil, tidak melakukan transfer uang nyata.
- **Bukan ERP UMKM.** Tidak ada stok, invoice, hutang/piutang, multi-cabang. Roadmap bisa dilihat di [`docs/roadmap.md`](../roadmap.md).
- **Bukan platform multi-channel chat.** Hanya WhatsApp. Tidak ada Telegram, Line, dll.

## Modul utama dalam repo

```
finapp/
├── backend/    Node.js + Express + Prisma + PostgreSQL + Redis (REST API + WA bot)
├── frontend/   React + Vite (web app: user + admin platform)
├── mobile/     Android Kotlin + Compose (klien mobile, masih awal)
└── docker-compose.yml  4 service: postgres, redis, backend, frontend
```

Detail isi tiap folder ada di [Reference: struktur repo](../reference/struktur-repo.md).

## Alur singkat sebuah transaksi WhatsApp

Untuk memberikan gambaran "rasa" produk, berikut alur paling khas:

1. User kirim WA: `keluar 50rb makan siang`.
2. Webhook backend (`POST /api/webhooks/whatsapp`) menerima pesan.
3. Bot mencari user lewat nomor / JID, lalu memanggil parser.
4. Parser heuristic (regex Bahasa Indonesia) mendeteksi: intent `input_pengeluaran`, amount `50000`, kategori "Makan", deskripsi "makan siang".
5. Bot menyimpan record `WhatsappPendingTransaction` (status `pending`, expire 10 menit) dan membalas pesan konfirmasi.
6. User balas `YA` → bot membuat record `Transaction` + update `Account.currentBalance` dalam satu Prisma `$transaction`, lalu mengirim konfirmasi sukses.

Jelas, kuadran [explanation/06-whatsapp-bot.md](./06-whatsapp-bot.md) membahas alur ini lebih dalam, sementara [explanation/07-ai-parser.md](./07-ai-parser.md) menjelaskan parsernya secara terpisah.

## Bahan bacaan lanjutan

- [Arsitektur sistem](./02-arsitektur-sistem.md) — peta komponen dan alur data.
- [Model multi-tenant](./03-model-multitenant.md) — kenapa ada `AccountIdentity` dan `TenantMember`.
- [Domain keuangan](./04-domain-keuangan.md) — invariant utama: saldo, transaksi, void, transfer.
