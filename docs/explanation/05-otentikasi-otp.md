# 5. Otentikasi & OTP WhatsApp

> Kuadran: **Explanation** — kenapa CatatIN pakai OTP via WhatsApp (bukan password) dan bagaimana JWT, Redis, serta link-account bekerja sama.

## Pilihan: OTP, bukan password

CatatIN tidak punya kolom password. Login dan registrasi sepenuhnya bergantung pada nomor WhatsApp:

1. User memasukkan nomor WhatsApp.
2. Backend mengirim OTP 6-digit via WhatsApp.
3. User memasukkan OTP di form.
4. Backend mengembalikan JWT.

Alasan keputusan ini:

- **Sesuai persona.** Pemilik UMKM dan pengguna Indonesia pada umumnya akrab dengan login OTP (mirip GoPay, OVO, dll).
- **Mengurangi friction.** Tidak perlu mengingat password atau reset password.
- **Menyatu dengan channel utama.** Channel kerja CatatIN adalah WhatsApp itu sendiri; jika user bisa terima OTP, dia juga bisa pakai bot WhatsApp.
- **Trade-off**: bergantung penuh pada deliverability gateway WhatsApp. Mode `mock` di development memprint OTP ke console (`mock.provider.js`).

## Komponen yang terlibat

```mermaid
flowchart LR
  U[User] --> Web[Frontend]
  Web -->|POST /auth/request-otp| BE[Backend]
  BE -->|incr rate-limit| R[(Redis)]
  BE -->|set otp:{purpose}:{number}, EX 5min| R
  BE -->|sendWhatsapp| Prov[Provider]
  Prov -->|chat OTP| U
  U -->|POST /auth/verify-otp| BE
  BE -->|GET otp key| R
  BE -->|bcrypt.compare| BE
  BE -->|JWT| Web
```

| Komponen | File | Catatan |
| --- | --- | --- |
| Endpoint OTP | `routes/auth.routes.js` | `register`, `request-otp`, `verify-otp` |
| Logika OTP | `services/otp.service.js` | hash bcrypt, TTL, rate-limit |
| Penyimpanan OTP | Redis | key `otp:{purpose}:{whatsappNumber}` |
| Pengiriman | `services/whatsapp/index.js` | dispatch ke provider sesuai `WA_PROVIDER` |
| JWT | `utils/jwt.js` + `middleware/auth.js` | sign & verify |

## Bentuk data OTP di Redis

Saat `requestOtp` dipanggil, Redis menyimpan JSON:

```json
{
  "userId": "...|null",
  "whatsappNumber": "6281234567890",
  "otpHash": "$2a$10$...",
  "purpose": "login | register",
  "attempts": 0,
  "expiresAt": "2026-05-26T01:30:00.000Z",
  "createdAt": "2026-05-26T01:25:00.000Z"
}
```

Key di-set dengan `EX = OTP_EXPIRES_MINUTES * 60` (default 5 menit). Hash dibuat dengan `bcrypt.hash(code, 10)`. **Kode plaintext** hanya tersimpan di pesan WhatsApp yang dikirim ke user—server tidak menyimpannya.

## Dua jalur rate-limit

Ada dua mekanisme rate-limit yang bekerja paralel:

1. **Rate limit per IP** untuk `/api/auth/*` — `express-rate-limit`, default 60 request / 15 menit per IP (`server.js:48-52`).
2. **Rate limit per nomor** di Redis — `OTP_RATE_LIMIT_COUNT` permintaan dalam jendela `OTP_RATE_LIMIT_WINDOW_MINUTES`. Default 3 / 15 menit (`otp.service.js:14-23`).

Kombinasi keduanya mencegah:
- Brute force OTP dari satu IP (rate limit IP).
- Spam pengiriman OTP ke nomor target (rate limit nomor).

## Verifikasi: anti brute-force di tahap kode

`verifyOtp` (`otp.service.js:56-91`):

- Mengecek `attempts >= OTP_MAX_ATTEMPTS` (default 5). Lebih dari itu → 429.
- Setiap salah, increment `attempts` di Redis (TTL dipertahankan).
- Saat benar, key Redis langsung di-delete supaya OTP tidak bisa dipakai dua kali.

`purpose` (login vs register) bisa dipilih atau dibiarkan auto-detect: `verify-otp` akan mencari kedua key kalau client tidak mengirim `purpose`.

## Apa yang JWT bawa

Token dibuat dengan `signToken({ userId, accountId, memberId, tenantId })`. Tidak ada role di JWT—role diambil ulang dari database setiap request. Alasannya: jika role berubah (mis. owner mendemote admin), perubahan langsung berlaku tanpa harus invalidasi token.

`middleware/auth.js` punya **dua jalur autentikasi**:

1. **Jalur identity** (`payload.accountId` ada): query `AccountIdentity → TenantMember → User`. Role/status diambil dari `TenantMember`. Ini jalur utama setelah migrasi multi-tenant.
2. **Jalur legacy** (`payload.accountId` tidak ada): query langsung `User`. Dipakai oleh token lama dan platform admin (yang tidak punya identity di banyak kasus).

Konsekuensi: JWT lama tetap valid setelah migrasi. Lihat [Multi-tenant](./03-model-multitenant.md#bagaimana-jwt-membawa-konteks).

## Logout & revoke

JWT stateless. Endpoint `POST /api/auth/logout` hanya membalas sukses; client membuang token. **Tidak ada token blacklist** — jika token bocor, kamu hanya bisa menunggu expire atau mengubah `JWT_SECRET` (yang akan menginvalidasi semua token).

Jika di masa depan dibutuhkan revoke per session, pertimbangkan: simpan `tokenVersion` di `User`, ikutkan ke JWT, dan invalidasi dengan increment versi.

## Hubungkan WhatsApp ke akun (link flow)

Login OTP **tidak otomatis** menjadikan user bisa kirim command via WhatsApp. Bot perlu tahu **JID** asli (mis. `6281234567890@c.us`) untuk routing pesan. Karena itu ada flow terpisah: link WhatsApp.

Dua varian link flow:

### Varian A — `link-token`
Dipakai jika user ingin kirim "kode" dari chat ke bot.
1. `POST /api/settings/whatsapp/link-token` membuat token `CATATIN-XXXXXX` (TTL 10 menit).
2. User mengetik di WhatsApp: `link CATATIN-123456`.
3. Bot memproses (`whatsapp-bot.service.js:230-282`), set `User.whatsappJid` & `AccountIdentity.whatsappJid`, audit log `whatsapp.link`.

### Varian B — `link-request`
Dipakai jika web ingin mendorong konfirmasi otomatis ke nomor user.
1. `POST /api/settings/whatsapp/link-request` mengirim pesan "Konfirmasi hubungkan…" ke nomor terdaftar.
2. Backend menyimpan `WhatsappLinkRequest` (status `pending`, expire 5 menit) dan cache di Redis (`wa:link-request:{number}`, TTL 5 menit) untuk pencarian cepat.
3. User membalas `YA` atau `BATAL`. Bot men-detect link request aktif (lihat `whatsapp-bot.service.js:64-109`) dan mengupdate JID + status request.

`link-request` cocok untuk handset yang sama dengan akun, sedangkan `link-token` cocok jika user mengelola akun di komputer dan WhatsApp di HP. Keduanya mengarah ke hasil sama: `whatsappJid` tersimpan di `User` dan `AccountIdentity`.

> **Plan limits.** Link flow hanya tersedia untuk plan yang punya `whatsappBot: true` (basic/pro). Lihat `settings.routes.js:144-147` dan `plans.js`.

## Path kegagalan dan UX-nya

| Kondisi | Backend respon | Frontend behaviour |
| --- | --- | --- |
| Nomor belum terdaftar saat login | 404 "Nomor WhatsApp belum terdaftar" | Toast error, sarankan register |
| User inactive / tenant inactive | 403 | Redirect halaman subscription / pesan ke admin |
| Rate limit terlampaui | 429 | Toast error |
| OTP salah | 400 "Kode OTP salah" | Toast error, increment counter local |
| OTP expired / tidak ada | 400 "OTP tidak ditemukan atau sudah expired" | Sarankan minta OTP ulang |
| Trial expired | 403 "Masa trial sudah berakhir" | Redirect `/settings/subscription` |
| Provider WhatsApp gagal | console error + (dev) fallback log | OTP tidak terkirim — di dev mode tetap di console |

Frontend axios interceptor (`frontend/src/lib/api.js`) menangani 401 (auto-redirect login) dan 403 langganan (auto-redirect subscription).

## Apa yang sengaja **tidak** dibangun

- **Email recovery.** Tidak ada email di skema; pemulihan akses dilakukan via dukungan platform admin yang dapat reset `whatsappJid` (`POST /api/admin/tenants/:tenantId/users/:userId/reset-whatsapp`) atau memindahkan ownership.
- **Sosial login.** Tidak ada Google/Apple login.
- **MFA selain OTP.** OTP via WhatsApp adalah satu-satunya faktor.
- **Session list / device management.** Token stateless tanpa daftar device.

Saat redesign, fitur-fitur ini bisa ditambahkan tanpa membongkar struktur yang ada. Email rekoveri, misalnya, hanya perlu kolom `email` di `AccountIdentity` + endpoint baru.

## Lanjut baca

- [API auth](../reference/api/auth.md) — bentuk request/response endpoint.
- [API settings](../reference/api/settings.md#whatsapp-link) — link-token & link-request.
- [WhatsApp bot](./06-whatsapp-bot.md) — sisi bot dari link flow.
- [Reference: env variables](../reference/env-variables.md#otp) — kontrol rate-limit & TTL.
