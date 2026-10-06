# Daftar Kode Error

> Kuadran: **Reference** — daftar status code, pesan error umum, dan asalnya. Source: dirangkum dari semua route + `utils/error.js`.

Backend pakai pola error sederhana lewat `HttpError(status, message)` di `backend/src/utils/error.js`. Error handler global merangkum:

- Status code default = `err.status || 500`.
- Body response: `{ message, details? }`.
- Di `NODE_ENV !== 'production'` dan status ≥ 500, body juga menyertakan `stack` (untuk debug).
- Error 5xx di-log ke console.

## Status code yang dipakai

| Code | Konteks |
| --- | --- |
| **200** | Sukses (read, update). |
| **201** | Sukses pembuatan resource. |
| **400** | Bad request (validasi gagal, payload aneh, kondisi domain dilanggar). |
| **401** | Tidak terotentikasi (tidak ada token, JWT salah). |
| **403** | Terotentikasi tapi tidak diizinkan (role / tenant / langganan / plan). |
| **404** | Resource tidak ditemukan. |
| **409** | Konflik state (duplikasi, owner terakhir, dst). |
| **429** | Rate limit / terlalu banyak percobaan. |
| **500** | Internal server error (bug). |
| **502** | Gagal memanggil dependency external (gateway WhatsApp). |

## Pesan umum yang user mungkin lihat

### Auth (`/api/auth/*`)

| Status | Pesan | Penyebab |
| --- | --- | --- |
| 409 | `Nomor WhatsApp sudah terdaftar. Silakan login.` | Register dengan nomor existing. |
| 404 | `Nomor WhatsApp belum terdaftar. Silakan register.` | Login OTP tapi nomor tidak ada. |
| 403 | `User tidak aktif` | Identity / user di-deactivate. |
| 400 | `OTP tidak ditemukan atau sudah expired` | OTP key di Redis sudah hilang. |
| 400 | `Kode OTP salah` | Hash bcrypt tidak match. |
| 429 | `Terlalu banyak permintaan OTP. Coba lagi nanti.` | Rate-limit per nomor (default 3 / 15 menit). |
| 429 | `Terlalu banyak percobaan OTP` | Salah masukkan kode > `OTP_MAX_ATTEMPTS`. |
| 401 | `Token tidak valid` | JWT verify gagal (expired / signature salah). |
| 403 | `Tenant tidak ditemukan` | `requireTenant` gagal. |
| 403 | `Tenant sudah dihapus` | `requireActiveSubscription`. |
| 403 | `Tenant tidak aktif` | `requireActiveSubscription`. |
| 403 | `Langganan tidak aktif` | `subscriptionStatus IN [inactive, suspended]`. |
| 403 | `Masa trial sudah berakhir` | `subscriptionStatus='trial'` & `trialEndsAt < now`. |
| 403 | `Anda tidak memiliki akses ke tenant ini` | switch-tenant ke tenant non-member. |
| 403 | `Hanya owner yang bisa menghapus tenant` | DELETE `/auth/tenants/:tenantId` non-owner. |
| 409 | `Anda harus memiliki minimal 1 tenant aktif` | DELETE tenant terakhir. |
| 409 | `Anda sudah memiliki tenant personal` | Buat 2 tenant personal lewat self-service. |
| 400 | `Akun tidak mendukung multi-tenant` / `Akun belum mendukung multi-tenant. Silakan login ulang.` | Token legacy memanggil endpoint identity-aware. |

### Accounts (`/api/accounts/*`)

| Status | Pesan | Penyebab |
| --- | --- | --- |
| 403 | `Plan {plan} maksimal {n} akun` | Buat akun melampaui limit plan. |
| 404 | `Akun tidak ditemukan` | ID tidak match tenant. |
| 400 | `Akun tidak aktif` | Service `createTransactionAtomic` saat akun inactive. |

### Categories

| Status | Pesan | Penyebab |
| --- | --- | --- |
| 409 | `Kategori sudah ada` | Duplikasi `(name, type)` per tenant. |
| 404 | `Kategori tidak ditemukan` | |
| 400 | `Kategori tidak sesuai tipe pemasukan/pengeluaran` | Mismatch type saat create/update transaction. |

### Transactions

| Status | Pesan | Penyebab |
| --- | --- | --- |
| 400 | `tenantId wajib` | service dipanggil tanpa context (bug). |
| 400 | `Akun wajib dipilih` | Validasi service. |
| 400 | `Tipe transaksi wajib` | Validasi service. |
| 400 | `Tipe transaksi tidak valid` | Type bukan income/expense/adjustment. |
| 400 | `Nominal harus lebih dari 0` | Amount ≤ 0 untuk income/expense. |
| 400 | `Akun asal dan tujuan tidak boleh sama` | Transfer self-loop. |
| 400 | `Saldo akun asal tidak cukup` | Transfer overdraft. |
| 400 | `Akun harus aktif` | Transfer ke/dari akun inactive. |
| 400 | `Transaksi sudah dibatalkan` | Void transaksi yang sudah void. |
| 400 | `Transaksi void tidak bisa diedit` | PATCH ke transaksi void. |
| 400 | `Transaksi penyesuaian saldo tidak bisa diedit dari menu transaksi` | PATCH ke type adjustment. |
| 404 | `Transaksi tidak ditemukan` | |
| 404 | `Akun lama / baru tidak ditemukan` | Update transaksi pindah akun. |

### Settings

| Status | Pesan | Penyebab |
| --- | --- | --- |
| 403 | `Hanya owner/admin yang bisa mengubah/menambah/menghapus user` | Akses rute users. |
| 403 | `Hanya owner/admin yang bisa mengubah tenant` | PATCH `/settings/tenant`. |
| 403 | `Plan {plan} maksimal {n} user` | Limit user. |
| 403 | `Role tujuan tidak diizinkan` | Owner/admin coba assign role di luar `allowedManagedRoles`. |
| 403 | `Admin tidak bisa mengubah/menghapus owner` | |
| 403 | `Tidak bisa mengubah role akun sendiri` / `Tidak bisa mengubah status akun sendiri` / `Tidak bisa menghapus akun sendiri` | |
| 409 | `Tenant harus memiliki minimal satu owner aktif` | Demote / deactivate / hapus owner terakhir. |
| 409 | `Nomor WhatsApp sudah dipakai user lain` | PATCH profile dengan nomor existing. |
| 409 | `Nomor WhatsApp sudah menjadi user tenant ini` | POST users dengan nomor yang sudah member. |
| 409 | `WhatsApp sudah terhubung. Putuskan dulu untuk menghubungkan ulang.` | link-request saat sudah linked. |
| 403 | `Fitur WhatsApp tersedia mulai plan Basic` | Plan free coba link. |
| 502 | `Gagal mengirim pesan WhatsApp: ...` | Gateway error saat link-request. |
| 400 | `Nomor WhatsApp akun tidak valid.` | Normalisasi gagal. |
| 403 | `Langganan tidak aktif` | Aksi yang butuh subscription saat suspended/inactive. |
| 409 | `Anda sudah memiliki tenant personal lain` | PATCH tenant change type to personal. |

### Admin (`/api/admin/*`)

| Status | Pesan | Penyebab |
| --- | --- | --- |
| 403 | `Hanya platform admin` | `requirePlatformAdmin`. |
| 404 | `Tenant tidak ditemukan` | |
| 404 | `User tidak ditemukan` | |
| 409 | `Nomor WhatsApp owner sudah terdaftar` | POST tenants. |
| 409 | `Nomor WhatsApp sudah menjadi user tenant ini` | |
| 409 | `Tenant harus memiliki minimal satu owner aktif` | |

## Path error tidak ditangani secara eksplisit

- **Zod validation error** akan dilempar oleh `parse(...)` di route handler. Saat ini error handler general meneruskan dengan status 500 jika tidak di-`asyncHandler`-wrap dengan benar. Saat redesign, pertimbangkan tangkap `ZodError` dan ubah menjadi 400 dengan `details: zodError.flatten()`.
- **Prisma error**: unique violation, foreign key, dll. Saat ini muncul sebagai 500. Bisa ditangkap dengan `Prisma.PrismaClientKnownRequestError` di `errorHandler`.

Lihat [How-to: tambah endpoint API](../how-to/tambah-endpoint-api.md) untuk pola validasi yang konsisten.

## Lanjut baca

- [API references](./api/) — detail respons sukses & error per endpoint.
- [Permissions & roles](./permissions-roles.md) — sumber 403.
