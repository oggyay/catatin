# Glosarium

> Daftar istilah CatatIN yang sering muncul di kode dan dokumentasi. Disusun alfabetis.

## A

### `AccountIdentity`
Identitas WhatsApp lintas tenant. Satu baris per nomor WhatsApp unik. Memegang `whatsappJid` (untuk routing pesan) dan `activeTenantId`. Lihat [Multi-tenant](./explanation/03-model-multitenant.md).

### `Account` (kantong)
Kantong uang di tenant: kas, bank, atau e-wallet. Memegang `currentBalance` yang dipersist. Tipe enum `AccountType` = `cash | bank | ewallet`.

### `adjustment` (transaksi)
Tipe transaksi penyesuaian saldo manual. Selalu disertai `BalanceAdjustment` 1-1 yang menyimpan `previousBalance`, `newBalance`, `difference`, `reason`. Lihat [Domain keuangan](./explanation/04-domain-keuangan.md#invariant-4--penyesuaian-saldo-bukan-sekadar-update-angka).

### `AuditLog`
Tabel append-only yang menyimpan perubahan penting. Format: `action`, `entityType`, `entityId`, `oldValue`, `newValue`. Tidak dipakai oleh business logic; murni untuk history.

## B

### `BalanceAdjustment`
Detail penyesuaian saldo. Relasi 1-1 dengan `Transaction(type='adjustment')`.

## C

### `cashflow`
Sederhana: total income − total expense per periode. Bukan laba-rugi formal. Endpoint: `GET /api/reports/cashflow`.

### `confidence`
Tingkat keyakinan parser terhadap hasil parse-nya. Nilai: `low | medium | high`. Hanya `high` yang bypass OpenAI fallback. Lihat [AI parser](./explanation/07-ai-parser.md#confidence-kapan-ai-dipakai).

## D

### default account
Akun yang dipilih bot sebagai akun otomatis saat user tidak menyebut nama akun. Field `Account.isDefault = true`. Hanya satu per tenant (enforced di route logic).

## E

### `entities`
Bagian dari hasil parser. Kumpulan field terstruktur: `amount`, `period`, `accountId`, `categoryId`, `description`, `date`, `dateText`, dst. Lihat [Reference: WA grammar](./reference/wa-command-grammar.md).

### expand-and-contract
Pola migrasi DB non-destruktif: tambah kolom baru lebih dulu (expand), backfill data, update kode, baru drop kolom lama (contract). Lihat [How-to: rollback migrasi](./how-to/rollback-migrasi.md).

## H

### heuristic parser
Lapisan parser pertama: regex + mapping kata di Bahasa Indonesia. Cepat & deterministik. Lihat [AI parser](./explanation/07-ai-parser.md).

### `HttpError`
Class error custom di `backend/src/utils/error.js`. Kombinasi `status` + `message` yang ditangkap `errorHandler` global.

## I

### identity
Singkatan untuk `AccountIdentity`. Bedakan dengan `User` (yang adalah proyeksi identity di tenant tertentu).

### intent
Kategori perintah hasil parser: `cek_saldo`, `input_pengeluaran`, dll. Lihat [WA grammar](./reference/wa-command-grammar.md).

## J

### JID (`whatsappJid`)
WhatsApp ID asli dari provider, contoh: `6281234567890@c.us`. Berbeda dari nomor (`6281234567890`). Diperlukan oleh provider untuk routing pesan kembali ke chat yang tepat.

## L

### `link-request`
Mekanisme link WhatsApp ke akun via balasan YA/BATAL. Backend mengirim pesan konfirmasi, bot men-detect balasan dan link. Lihat [Otentikasi](./explanation/05-otentikasi-otp.md#hubungkan-whatsapp-ke-akun-link-flow).

### `link-token`
Mekanisme link WhatsApp via kode `CATATIN-XXXXXX` yang user ketik di WA.

## M

### mock provider
Provider WhatsApp default di development. OTP & balasan diprint ke console alih-alih dikirim WA asli. Lihat `services/whatsapp/mock.provider.js`.

## O

### OTP
One-Time Password. Kode 6 digit dikirim ke WhatsApp untuk verifikasi login/register. Disimpan di Redis dengan TTL 5 menit. Lihat [Otentikasi](./explanation/05-otentikasi-otp.md).

### owner / admin / member
Tiga role di dalam tenant. Disimpan di `TenantMember.role`. Lihat [Permissions](./reference/permissions-roles.md).

## P

### parser
Komponen yang mengubah pesan WhatsApp bebas menjadi struktur `{ intent, entities }`. Implementasi di `services/whatsapp/parser.js`.

### `pending` (transaksi)
Transaksi yang menunggu konfirmasi `YA`/`BATAL` di WA. Disimpan di `WhatsappPendingTransaction` dengan status `pending` dan TTL `WA_PENDING_EXPIRES_MINUTES` (default 10).

### plan
Tier subscription: `free`, `basic`, atau `pro`. Mengontrol `maxUsers`, `maxAccounts`, dan apakah WhatsApp bot tersedia. Lihat `config/plans.js`.

### platform admin
Role khusus (`User.role = 'platform_admin'`) untuk tim CatatIN. Tidak terikat tenant. Akses endpoint `/api/admin/*`.

## R

### `requireActiveSubscription`
Middleware backend yang menolak request jika tenant `inactive`/`suspended` atau trial sudah expired.

## S

### saldo dipersist
Pola di mana `Account.currentBalance` adalah angka tunggal yang disimpan, bukan hasil agregat. Diupdate atomik bersama insert/update/void transaksi. Lihat [Domain keuangan](./explanation/04-domain-keuangan.md#invariant-1--saldo-selalu-konsisten-dengan-transaksi-aktif).

### scoping (multi-tenant)
Praktik selalu menambahkan `tenantId: req.tenantId` di setiap query bisnis untuk mencegah data leak antar tenant. Aturan #1 saat menambah endpoint baru.

### single-entry
Pola pembukuan di mana setiap transaksi mengubah satu akun (kecuali transfer). Bedakan dari double-entry (debit/kredit). Lihat ADR-001.

### soft delete
Penghapusan via flag (`status='inactive'` atau `deletedAt: timestamp`) bukan hard delete. Dipakai untuk akun, kategori, transaksi (sebagai `void`), tenant, user, dan member. Lihat ADR-006.

### `source` (transaksi)
Asal transaksi: `web`, `whatsapp`, atau `adjustment`. Hanya untuk filter & display.

### `status` (transaksi)
`active` atau `void`. Tidak ada status lain.

### switch-tenant
Operasi pindah tenant aktif untuk identity. Endpoint `POST /api/auth/switch-tenant`. Mengeluarkan JWT baru.

## T

### tenant
Workspace keuangan. Bisa bertipe `personal` atau `umkm`. Setiap query bisnis di-scope ke satu tenant.

### `TenantMember`
Junction antara `AccountIdentity` dan `Tenant` dengan field `role` dan `status`. Sumber kebenaran modern untuk role per tenant.

### transfer (`transferGroupId`)
Operasi pindah uang antar dua akun di tenant yang sama. Direpresentasikan sebagai sepasang transaksi (`expense` + `income`) yang berbagi `transferGroupId` (UUID acak). Tidak punya kategori.

### trial
Status subscription saat baru register. Default 14 hari. Setelah `trialEndsAt`, request bisnis ditolak hingga plan diubah.

## U

### `User`
Proyeksi identity di tenant tertentu. Tabel ini ada karena migrasi historis dari skema single-tenant ke multi-tenant. Field role/status di-mirror dari `TenantMember`. Lihat [ADR-002](./explanation/09-keputusan-arsitektur.md#adr-002-multi-tenant-via-accountidentity--tenantmember).

## V

### void
Status transaksi yang dibatalkan. Saldo akun dikompensasi balik. Tidak hard delete. Endpoint `POST /api/transactions/:id/void`.

## W

### WAHA
Open-source WhatsApp HTTP API gateway (https://waha.devlike.pro). Salah satu provider yang didukung CatatIN.

### WA-AKG
Cloud gateway WhatsApp pihak ketiga. Provider generik dengan endpoint `/send`. Bisa juga dipakai untuk gateway lain dengan API serupa.

### `WA_PROVIDER`
Env variable yang memilih provider WhatsApp aktif: `mock`, `waha`, atau `wa-akg`/`waakg`.

### webhook (WhatsApp)
Endpoint `POST /api/webhooks/whatsapp` yang menerima pesan inbound dari gateway. Mendukung beberapa shape payload (WAHA-style, generic).

### `WhatsappLog`
Tabel audit pesan dwi-arah (inbound/outbound) ke/dari bot. Berguna untuk debugging parser dan analytics command.

## Lanjut baca

- [Overview produk](./explanation/01-overview-produk.md).
- [PRD Ringkas](./prd-ringkas.md).
- [ADR ringkas](./explanation/09-keputusan-arsitektur.md).
