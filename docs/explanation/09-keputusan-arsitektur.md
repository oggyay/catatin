# 9. Keputusan Arsitektur (ADR Ringkas)

> Kuadran: **Explanation** — keputusan kunci, alasan, alternatif yang ditolak, dan kapan mempertimbangkan ulang.

Format ringkas, mengikuti gaya Architecture Decision Records: setiap keputusan menjelaskan **konteks**, **keputusan**, **konsekuensi**, dan **kapan re-visit**.

## ADR-001: Single-entry bookkeeping, bukan double-entry

**Konteks.** CatatIN ditujukan untuk pencatatan kas sederhana, bukan akuntansi formal. User target tidak punya pengetahuan akuntansi (debit/kredit).

**Keputusan.** Setiap transaksi mengubah satu akun. Saldo akun adalah angka tunggal yang dipersist. Tidak ada chart of accounts, tidak ada jurnal, tidak ada laporan laba-rugi formal.

**Konsekuensi.**
- (+) Sederhana, mudah dipahami end user.
- (+) Skema database minimal.
- (–) Tidak bisa diaudit secara akuntansi.
- (–) Migrasi ke double-entry membutuhkan rewrite domain (akan menjadi proyek besar).

**Re-visit jika.** Target user bergeser ke akuntan profesional, atau ada kebutuhan integrasi keluar ke software akuntansi formal (Accurate, Jurnal, Zoho Books).

## ADR-002: Multi-tenant via `AccountIdentity` + `TenantMember`

**Konteks.** Awalnya skema hanya punya `User` (satu baris per orang per tenant). Saat fitur multi-tenant ditambahkan, ada dua opsi:

- (a) Rewrite: hapus `User`, gunakan junction table baru.
- (b) Tambah: introduksi `AccountIdentity` dan `TenantMember`, pertahankan `User` sebagai proyeksi.

**Keputusan.** Pilih (b). `User` dipertahankan supaya FK dari `Transaction.userId`, `AuditLog.userId`, `Otp.userId`, dll. tidak perlu di-rewrite. `AccountIdentity` jadi sumber kebenaran identitas (nomor WA unik), `TenantMember` jadi sumber kebenaran role per tenant. `User` di-mirror saat `TenantMember` berubah.

**Konsekuensi.**
- (+) Migrasi non-destruktif; data lama tetap valid.
- (+) Pengguna dapat ganti tenant tanpa logout.
- (–) Tiga tabel untuk konsep yang konseptualnya satu — duplikasi data nama/nomor.
- (–) Update role/status harus diaplikasikan di **dua tempat** (`User` + `TenantMember`) — gampang lupa di endpoint baru.

**Re-visit jika.** Volume tenant per identity menjadi sangat besar, atau muncul kebutuhan invitation flow yang kompleks. Rewrite ke pure junction table mungkin masuk akal saat itu.

Detail lebih lanjut: [Multi-tenant](./03-model-multitenant.md).

## ADR-003: OTP-only authentication

**Konteks.** Aplikasi ditujukan untuk audiens Indonesia yang familiar dengan OTP (mirip e-wallet). Password berisiko lupa, butuh form reset, butuh email recovery (yang tidak diminta).

**Keputusan.** Login dan registrasi menggunakan OTP via WhatsApp. Tidak ada kolom password.

**Konsekuensi.**
- (+) UX lebih sederhana untuk persona target.
- (+) Tidak menyimpan secret yang bisa bocor.
- (+) Kanal OTP sama dengan kanal kerja (WhatsApp) → aktivasi mulus.
- (–) Tergantung deliverability gateway WhatsApp.
- (–) Recovery susah jika nomor user hilang akses (mitigasi: platform admin bisa reset).
- (–) Tidak cocok untuk regulasi yang mewajibkan multi-faktor formal.

**Re-visit jika.** Ada kebutuhan compliance (mis. fintech regulasi), atau audiens berkembang ke pasar non-Indonesia di mana penetrasi WhatsApp rendah.

Detail: [Otentikasi & OTP](./05-otentikasi-otp.md).

## ADR-004: JWT stateless tanpa revoke

**Konteks.** Backend horizontal-scalable lebih disukai. Session server membutuhkan sticky session atau session store.

**Keputusan.** JWT signed dengan `JWT_SECRET`, tanpa server-side store. Logout client-side (drop token).

**Konsekuensi.**
- (+) Stateless, mudah scale.
- (+) Mobile dan web pakai mekanisme yang sama.
- (–) Tidak bisa revoke token tunggal. Mengganti `JWT_SECRET` membatalkan semua token.
- (–) Saat role berubah, perlu logout-relogin **kecuali** jika route mengambil role dari DB setiap request—yang memang dilakukan oleh `middleware/auth.js`.

**Re-visit jika.** Butuh fitur "logout from all devices" atau "session list per user". Solusi: tambah `tokenVersion` di `User`, sertakan di JWT payload, naikkan saat revoke.

## ADR-005: Saldo dipersist, bukan dihitung dari transaksi

**Konteks.** Mode "compute on read" sederhana untuk konsistensi tapi mahal untuk dashboard yang menampilkan saldo banyak akun.

**Keputusan.** `Account.currentBalance` disimpan dan diupdate atomik bersama insert/update/void transaksi (lihat `transaction.service.js`). Read saldo adalah `SELECT` murni.

**Konsekuensi.**
- (+) Read sangat cepat (untuk dashboard, list akun).
- (+) Audit jelas — saldo selalu kebawa di update yang sama.
- (–) Saldo bisa drift jika ada path tulis di luar service (bug). Mitigasi: semua tulis lewat 4 fungsi terpusat.
- (–) Memerlukan locking implisit Postgres (yang Prisma `$transaction` sediakan).

**Re-visit jika.** Ada kebutuhan history saldo per titik waktu untuk audit forensik. Bisa pertimbangkan event sourcing partial: `BalanceLedger` untuk audit, `Account.currentBalance` tetap sebagai cache.

Detail: [Domain keuangan](./04-domain-keuangan.md).

## ADR-006: Soft delete via flag, bukan hard delete

**Konteks.** Foreign key dari `Transaction` ke `Account`, `Category`, `User`, `Tenant`. Hard delete akan memutus history.

**Keputusan.** Untuk entitas yang sudah punya child:
- `Account.status = 'inactive'` daripada delete.
- `Category.status = 'inactive'`.
- `Transaction.status = 'void'`.
- `Tenant.deletedAt`, `User.deletedAt`, `TenantMember.deletedAt`.

Hard delete hanya jika tidak ada child (mis. akun baru tanpa transaksi).

**Konsekuensi.**
- (+) History tetap valid dan dapat dibaca.
- (+) Recovery tinggal balikkan flag.
- (–) Query bisnis perlu filter `deletedAt: null` / `status != 'inactive'` di banyak tempat — risiko lupa.
- (–) Data terus tumbuh; perlu policy retention manual.

**Re-visit jika.** Ada kewajiban regulasi penghapusan data (mis. GDPR-like) yang mewajibkan true delete.

## ADR-007: WhatsApp diproses inline tanpa queue

**Konteks.** Volume awal kecil (UMKM dengan beberapa pesan per hari per user). Tambahan queue (BullMQ / Redis Streams) menambah operasional.

**Keputusan.** Webhook membalas 200 OK lalu memanggil `handleIncomingMessage` async (fire-and-forget) di proses Express yang sama.

**Konsekuensi.**
- (+) Setup minimal; satu service backend cukup.
- (+) Latensi rendah saat volume rendah.
- (–) Tidak ada retry otomatis jika handler crash di tengah.
- (–) Multi-instance backend punya state in-memory dedup yang tidak konsisten antar pod.
- (–) Pesan lambat dari OpenAI bisa bersaing dengan request HTTP biasa.

**Re-visit jika.** Volume melebihi ~50 pesan/menit, atau deploy multi-pod. Path migrasi:
1. Pindahkan dedup ke Redis (`SET NX EX 30`).
2. Tambah queue: webhook hanya enqueue, worker terpisah memproses.
3. Tambah retry policy + dead-letter.

## ADR-008: Heuristic parser dulu, OpenAI sebagai enhancer

**Konteks.** OpenAI mahal dan lambat (ratusan ms). Banyak command WhatsApp pendek dan formatnya jelas.

**Keputusan.** Heuristic regex Bahasa Indonesia di-jalankan dulu. Jika confidence high, return langsung. Jika tidak, dan AI diaktifkan, panggil OpenAI dengan JSON mode untuk enhance.

**Konsekuensi.**
- (+) Biaya OpenAI rendah (sebagian besar pesan dilayani heuristic).
- (+) Sistem tetap berjalan bila OpenAI mati / API key dicabut.
- (+) Tanggal tidak dihalusinasi karena heuristic memenangkan field date.
- (–) Heuristic jadi basis kebenaran; bug di heuristic akan memengaruhi semua user, bahkan yang seharusnya disempurnakan AI.
- (–) Dua jalur logic untuk satu domain.

**Re-visit jika.** Akurasi parsing bahasa kasual penting untuk akuisisi user, atau model on-device makin tersedia (LLM lokal kecil yang bisa menggantikan call cloud).

Detail: [AI parser](./07-ai-parser.md).

## ADR-009: Postgres tunggal tanpa Row-Level Security

**Konteks.** Multi-tenant tanpa RLS bisa rentan data leak jika kode lupa filter. Sebaliknya, RLS PostgreSQL menambah kompleksitas pengelolaan role DB.

**Keputusan.** Single Postgres database tunggal, tenant scoping dilakukan di application layer (`tenantId: req.tenantId` di setiap query bisnis).

**Konsekuensi.**
- (+) Setup DB sederhana; satu user satu schema.
- (+) Migrasi dengan Prisma straightforward.
- (–) Risiko data leak antar tenant jika ada endpoint yang melewatkan filter (audit manual diperlukan).
- (–) Tidak ada isolasi storage antar tenant.

**Mitigasi saat ini.**
- Middleware `requireTenant` memastikan `req.tenantId` ada.
- Konvensi semua route `where: { tenantId: req.tenantId, ... }` (lihat semua route file).
- Code review wajib untuk endpoint baru.

**Re-visit jika.** Audit security atau compliance mengharuskan isolasi tenant level kuat (mis. enterprise customer yang minta dedicated database). RLS Postgres atau database-per-tenant bisa dipertimbangkan.

## ADR-010: REST + JSON, bukan GraphQL

**Konteks.** Frontend tunggal (React) dan mobile sederhana (Compose). Endpoint relatif sedikit.

**Keputusan.** REST dengan resource konvensional (`/api/accounts`, `/api/transactions`, dll), JSON body, pagination via query string.

**Konsekuensi.**
- (+) Cepat dipahami developer baru.
- (+) Tidak butuh tooling tambahan.
- (–) Beberapa endpoint melakukan over-fetch (mis. dashboard memanggil 4 endpoint paralel; di GraphQL bisa satu request).
- (–) Tidak ada schema yang dibagi antara frontend & backend (zod hanya di backend).

**Re-visit jika.** Mobile/web memerlukan banyak round-trip yang merepotkan, atau konsumer eksternal (partner, integrasi) butuh schema discovery. Pilihan migrasi: GraphQL atau OpenAPI generated.

## ADR-011: Vite + React tanpa state-management library

**Konteks.** Frontend web tidak punya state global yang kompleks. Halaman utamanya CRUD + dashboard.

**Keputusan.** Pakai `useState`, `useEffect`, satu `AuthContext`. Tidak pakai Redux / Zustand / Recoil.

**Konsekuensi.**
- (+) Setup minimal, file sedikit.
- (+) Tidak ada boilerplate action/reducer.
- (–) State antar halaman berarti reload (mis. setelah simpan, panggil `load()` ulang).
- (–) Beberapa data (akun, kategori) di-fetch berulang kali oleh halaman berbeda.

**Re-visit jika.** Frontend tumbuh ke fitur dengan state lintas halaman (mis. wizard multi-step, undo/redo, real-time collaboration). Pilihan: Zustand (ringan) atau React Query untuk caching server data.

## ADR-012: Mobile native Android (bukan React Native / Flutter)

**Konteks.** Mobile masih early-stage. Tim sudah punya pengalaman Android Compose.

**Keputusan.** Native Android dengan Kotlin + Compose + Ktor + Koin DI.

**Konsekuensi.**
- (+) Performa native, akses penuh API Android.
- (+) Konsisten dengan tooling Android modern.
- (–) iOS perlu codebase terpisah jika nanti dibutuhkan.
- (–) Lebih lambat berkembang dibanding web yang sudah lebih lengkap.

**Re-visit jika.** Kebutuhan iOS muncul cepat; pertimbangkan rewrite ke KMP (Kotlin Multiplatform) atau Flutter.

## Ringkasan keputusan terbuka untuk redesign

Saat redesign, **paling layak dipertimbangkan ulang**:
- ADR-007 (queue): batas paling cepat tercapai jika user growth.
- ADR-009 (RLS): batas paling cepat tercapai jika audit/compliance.
- ADR-002 (multi-tenant struktur): paling layak dirapikan jika tim mau investasi refactor besar.

**Paling stabil & tidak perlu diutak-atik**:
- ADR-001 (single-entry).
- ADR-005 (saldo dipersist).
- ADR-006 (soft delete).
- ADR-008 (parser hybrid).

## Lanjut baca

- Daftar lengkap explanation: [01–08](./01-overview-produk.md).
- [Roadmap](../roadmap.md) — jika keputusan di atas mau dibuka kembali.
