# PRD Ringkas — CatatIN

> Dokumen ini direkonstruksi dari kode sumber (bukan dari dokumen PRD asli yang tidak ada di repo). Tujuan: memberi gambaran "what & why" yang ringkas untuk redesign atau perencanaan fitur baru.

## Ringkasan produk

**CatatIN** adalah aplikasi pencatatan keuangan multi-tenant berbasis web dan WhatsApp untuk **individu** dan **UMKM** di Indonesia. Pengguna dapat mencatat pemasukan, pengeluaran, transfer antar akun, serta hutang/piutang global lewat web atau bot WhatsApp dengan parser Bahasa Indonesia.

## Persona target

| Persona | Karakteristik | Channel utama |
| --- | --- | --- |
| Pemilik UMKM kecil | Tidak punya tim keuangan, ingin tahu omzet & biaya harian | WhatsApp |
| Individu / pengelola keuangan pribadi | Punya beberapa kantong (kas + bank + e-wallet), butuh ringkasan cepat | Web |
| Platform admin (internal) | Mengelola tenant, plan, dan dukungan pengguna | Web |

## Tujuan produk

1. **Catat sebelum lupa.** Friction sekecil mungkin dari "ada transaksi" ke "tercatat".
2. **Lihat ringkasan tanpa belajar akuntansi.** Cashflow, kategori terbesar, saldo per akun—dalam 1 layar.
3. **Multi-konteks tanpa kebingungan.** Satu identitas WhatsApp boleh punya catatan pribadi + UMKM tanpa bercampur.

## Non-tujuan

- Bukan software akuntansi formal (tidak ada double-entry, neraca, laba-rugi).
- Bukan e-wallet atau payment processor.
- Bukan ERP UMKM (tidak ada stok, invoice, multi-cabang, atau manajemen kontak hutang/piutang per orang).
- Bukan platform multi-channel chat (hanya WhatsApp).

## Fitur inti yang sudah dibangun

### Otentikasi
- Login & registrasi via OTP WhatsApp (tanpa password).
- JWT 7 hari, stateless.
- Rate-limit OTP per nomor + per IP.
- Link WhatsApp ke akun via token `CATATIN-XXXXXX` atau via konfirmasi balas YA.

### Multi-tenant
- Satu identitas (`AccountIdentity`) bisa jadi member di banyak tenant.
- Tiap tenant punya tipe `personal` atau `umkm`.
- Aturan: maksimal 1 tenant `personal` per identitas, banyak `umkm` boleh.
- Switch tenant tanpa logout.

### Keuangan
- CRUD akun (cash/bank/ewallet/hutang/piutang) dengan limit per plan.
- CRUD kategori income/expense (15 kategori bawaan).
- Transaksi: income, expense, adjustment, transfer antar akun.
- Saldo akun dipersist + diupdate atomik (Prisma `$transaction`).
- Penyesuaian saldo manual dengan audit detail (`BalanceAdjustment`).
- Void (bukan delete) untuk transaksi yang salah.
- Hapus permanen akun inactive dengan cleanup transaksi/adjustment yang masih mereferensikan akun.
- Filter & pagination transaksi (tipe, akun, kategori, sumber, status, range tanggal, search).
- Upload bukti transaksi (`attachmentUrl`) — saat ini struktur sudah ada, multipart aktif menyusul.
- Hutang/piutang global lewat akun khusus `hutang` dan `piutang`, termasuk ringkasan saldo dan command bot.

### Laporan
- Dashboard KPI: total saldo, pemasukan/pengeluaran bulan, net cashflow, top kategori.
- Cashflow per periode (today/this_week/this_month/custom).
- Export Excel multi-sheet (ringkasan, kategori, akun, raw transaksi).

### WhatsApp bot
- Intent: `cek_saldo`, `cek_pengeluaran`, `cek_pemasukan`, `riwayat_transaksi`, `input_pengeluaran`, `input_pemasukan`, `transfer_akun`, `cek_hutang`, `cek_piutang`, `catat_hutang`, `bayar_hutang`, `catat_piutang`, `terima_piutang`, `konfirmasi`, `batal`, `help`.
- Pending confirmation flow (YA / BATAL, expire 10 menit).
- Riwayat transaksi via command seperti `riwayat`, `riwayat hari ini`, `riwayat bulan ini`, `transaksi terakhir 10`.
- Dukungan pesan grup WAHA: lookup user dari participant, reply ke group chat, dan best-effort `sendSeen`.
- Adapter provider: `mock`, `waha`, `wa-akg`. Mudah ditambah.
- Logging dwi-arah ke `WhatsappLog`.

### AI parser
- Heuristic regex Bahasa Indonesia (variasi nominal, periode, tanggal, mapping kategori).
- Fallback OpenAI saat heuristic confidence < high (opsional, dimatikan secara default).

### Admin platform
- CRUD tenant + owner.
- Kelola plan & subscription status manual.
- Reset link WhatsApp user (recovery).
- Usage agregat (jumlah tenant, user, transaksi, pesan WA).

### Subscription & plan
- 3 plan × 2 type (free/basic/pro × personal/umkm).
- Plan memiliki batas `maxUsers`, `maxAccounts`, dan flag `whatsappBot`.
- Trial period 14 hari di register (default).

## Struktur data utama

Lihat [Skema database](./reference/database-schema.md) untuk detail. Singkatnya:

- **`AccountIdentity`** — identitas WhatsApp (nomor unik).
- **`TenantMember`** — junction identity ↔ tenant + role.
- **`Tenant`** — workspace keuangan.
- **`User`** — proyeksi identity di tenant tertentu.
- **`Account`** — kantong uang (saldo dipersist), termasuk akun khusus hutang/piutang.
- **`Category`** — klasifikasi income/expense.
- **`Transaction`** — perubahan saldo (income/expense/adjustment).
- **`BalanceAdjustment`** — detail penyesuaian saldo manual.
- **`WhatsappPendingTransaction`** — transaksi menunggu konfirmasi YA/BATAL.
- **`WhatsappLog`** — audit trail pesan dwi-arah.
- **`AuditLog`** — perubahan penting tenant/user/transaksi.

## Aturan domain (invariant)

1. Saldo akun selalu konsisten dengan transaksi aktif (semua tulis lewat service atomic).
2. Kategori cocok dengan tipe transaksi (income vs expense).
3. Transfer = sepasang transaksi dengan `transferGroupId` sama.
4. Penyesuaian saldo selalu disertai record `BalanceAdjustment` 1-1.
5. Akun & kategori yang sudah dipakai → soft-deactivate terlebih dahulu; akun inactive dapat dihapus permanen setelah transaksi terkait di-void/cleanup.
6. Transaksi tidak pernah hard delete; hanya void.
7. Setiap query bisnis di-scope `tenantId`.
8. Minimal 1 owner aktif per tenant; minimal 1 tenant aktif per identity.

## Plan limit (saat penulisan)

| Type | Plan | Max users | Max accounts | WhatsApp bot |
| --- | --- | --- | --- | --- |
| personal | free | 1 | 2 | ✗ |
| personal | basic | 1 | 5 | ✓ |
| personal | pro | 2 | 8 | ✓ |
| umkm | free | 1 | 2 | ✗ |
| umkm | basic | 3 | 5 | ✓ |
| umkm | pro | 20 | 30 | ✓ |

Sumber: `backend/src/config/plans.js`.

## Metric / signal yang sudah diukur

- Per tenant: jumlah user, akun, transaksi, pesan WA inbound.
- Per platform: total tenant, user, transaksi, pesan WA, pending (lihat `/api/admin/usage`).
- Audit log: setiap perubahan signifikan punya record (lihat `AuditLog.action`).

## Yang sengaja **belum** dibangun

- Email login / recovery.
- MFA selain OTP WhatsApp.
- Telegram / SMS / Email channel.
- Stok, invoice, dan manajemen kontak hutang/piutang per orang.
- Multi-cabang.
- Pembayaran via payment gateway.
- WhatsApp interactive button.
- Reminder proaktif dari bot.
- iOS native.

Lihat [Roadmap](./roadmap.md) untuk daftar lebih lengkap.

## Asumsi & batasan

- Mata uang Rupiah Indonesia (IDR) saja. Tidak ada multi-currency.
- Single timezone server (set `TZ=Asia/Jakarta` di production).
- Single Postgres (tidak ada sharding).
- Single backend instance (tidak ada queue / multi-pod yang kuat).
- Pengguna utama berbahasa Indonesia. Parser heuristik dirancang untuk Bahasa Indonesia kasual.

## Trade-off arsitektur

Lihat [ADR ringkas](./explanation/09-keputusan-arsitektur.md) untuk daftar lengkap. Yang paling penting:

- **OTP-only auth** — friction rendah tapi recovery susah.
- **Single-entry bookkeeping** — sederhana tapi tidak bisa diaudit secara akuntansi.
- **Saldo dipersist** — read cepat tapi rentan drift jika ada path tulis di luar service.
- **Inline WhatsApp processing** — minim infra tapi tidak skala horizontal.
- **No RLS, scoping di app** — flexible tapi rentan data leak jika developer lupa filter.

## Bahan untuk redesign

Beberapa area yang paling siap untuk diiterasi:

1. **Mobile native** — saat ini struktur ada tapi belum lengkap.
2. **Frontend design system** — saat ini single CSS file, belum ada komponen reusable formal.
3. **Dashboard visual** — grafik cashflow, pengeluaran per kategori, dan tren saldo.
4. **Bot lebih cerdas** — masukkan training data dari `WhatsappLog` ke parser.
5. **Reminder & insight proaktif** — saldo turun cepat, kategori X melonjak, dll.
6. **Manajemen kontak hutang/piutang** — tracking per orang/supplier tanpa menjadikan setiap orang sebagai akun.
7. **Multi-channel** — Telegram, Email, dengan adapter pattern yang sama.

## Lanjut baca

- [Overview produk](./explanation/01-overview-produk.md) — versi explanation lebih panjang.
- [Arsitektur sistem](./explanation/02-arsitektur-sistem.md).
- [Roadmap](./roadmap.md).
- [Glosarium](./glossary.md).
