# API: Auth

> Kuadran: **Reference** — endpoint registrasi, OTP, JWT, manajemen tenant per identity. Source: `backend/src/routes/auth.routes.js`.

Base path: `/api/auth`. Rate limit: 60 request / 15 menit per IP (`server.js:48-52`).

Semua endpoint kecuali `me`, `tenants`, `switch-tenant`, `tenants` (POST), `tenants/:id` (DELETE), `logout` adalah **publik** (tidak butuh JWT).

## POST `/auth/register`

Registrasi tenant + owner baru sekaligus mengirim OTP.

**Request body**

```json
{
  "name": "Joni",
  "whatsappNumber": "081234567890",
  "businessName": "Warung Joni",
  "type": "umkm"
}
```

| Field | Tipe | Wajib | Catatan |
| --- | --- | --- | --- |
| `name` | string ≥ 2 | ya | nama owner |
| `whatsappNumber` | string ≥ 6 | ya | dinormalisasi otomatis (`08...` → `62...`) |
| `businessName` | string ≥ 2 | ya | nama tenant |
| `type` | `personal`/`umkm` | tidak (default `personal`) | |

**Side effects** (dalam satu transaction):
- Buat `Tenant` (plan `free`, status `trial`, `trialEndsAt = now + 14 hari`).
- Buat `AccountIdentity` dengan `activeTenantId` ke tenant baru.
- Buat `User` (role `owner`).
- Buat `TenantMember`.
- Buat `Account` "Kas Tunai" (default).
- Buat default income & expense categories.
- Tulis audit `tenant.register`.
- Kirim OTP via WhatsApp (purpose `register`).

**Response 200**

```json
{ "message": "OTP telah dikirim ke WhatsApp Anda", "whatsappNumber": "6281234567890" }
```

**Error**
- 409 — nomor sudah terdaftar.
- 429 — rate limit OTP atau IP.

## POST `/auth/request-otp`

Minta OTP untuk login (atau register jika nomor belum terdaftar — sesuai `purpose`).

**Request body**

```json
{ "whatsappNumber": "081234567890", "purpose": "login" }
```

| Field | Wajib | Default | Pilihan |
| --- | --- | --- | --- |
| `whatsappNumber` | ya | - | - |
| `purpose` | tidak | `login` | `login` / `register` |

**Response 200**

```json
{ "message": "OTP telah dikirim ke WhatsApp Anda", "whatsappNumber": "6281234567890" }
```

**Error**
- 404 — nomor belum terdaftar (saat purpose `login`).
- 403 — user/identity tidak aktif.
- 429 — rate limit.

## POST `/auth/verify-otp`

Verifikasi kode OTP, kembalikan JWT.

**Request body**

```json
{ "whatsappNumber": "081234567890", "code": "123456", "purpose": "login" }
```

`purpose` opsional. Jika kosong, backend mencoba kedua purpose (login lalu register).

**Response 200**

```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "ckxxx",
    "name": "Joni",
    "whatsappNumber": "6281234567890",
    "whatsappJid": null,
    "whatsappLinked": false,
    "role": "owner",
    "tenantId": "ckyyy",
    "tenant": {
      "id": "ckyyy",
      "name": "Warung Joni",
      "type": "umkm",
      "subscriptionPlan": "free",
      "subscriptionStatus": "trial",
      "trialEndsAt": "2026-06-09T00:00:00.000Z"
    }
  },
  "tenants": [
    {
      "tenantId": "ckyyy",
      "memberId": "ckmm",
      "tenantName": "Warung Joni",
      "tenantType": "umkm",
      "role": "owner"
    }
  ]
}
```

`tenants` adalah daftar semua membership aktif identity. Frontend menggunakannya untuk dropdown switcher (lihat `AppLayout.jsx`).

**Error**
- 400 — kode salah / OTP expired / OTP tidak ditemukan.
- 403 — user/identity tidak aktif.
- 404 — user tidak ditemukan setelah verifikasi (kondisi langka, biasanya integritas data).
- 429 — terlalu banyak percobaan kode.

## GET `/auth/me`

Info user saat ini + daftar membership.

Header: `Authorization: Bearer <token>`.

**Response 200**

```json
{ "user": { ... seperti di verify-otp ... }, "tenants": [ ... ] }
```

`tenants` adalah `null` untuk token legacy yang tidak punya `accountId` (mis. platform admin lama).

## GET `/auth/tenants`

Daftar tenant aktif yang dimiliki identity (untuk switcher).

**Response 200**

```json
{
  "data": [
    {
      "tenantId": "ckyyy",
      "memberId": "ckmm",
      "tenantName": "Warung Joni",
      "tenantType": "umkm",
      "role": "owner",
      "isActive": true
    }
  ]
}
```

`isActive` true untuk tenant yang sedang dipakai (`AccountIdentity.activeTenantId`).

## POST `/auth/switch-tenant`

Pindah konteks tenant.

**Request body**

```json
{ "tenantId": "ckxxx" }
```

**Side effects**
- Update `AccountIdentity.activeTenantId`.
- Tulis audit `identity.switch_tenant`.
- Buat JWT baru untuk tenant tujuan.

**Response 200**

```json
{ "token": "eyJ...", "user": { ... } }
```

**Error**
- 400 — token tidak punya identity (login ulang).
- 403 — bukan member tenant tujuan, atau tenant inactive.
- 404 — user di tenant tujuan tidak ditemukan.

## POST `/auth/tenants`

Buat tenant baru untuk identity yang sudah login (self-service).

**Request body**

```json
{ "name": "Toko Cabang B", "type": "umkm" }
```

**Side effects** sama dengan register, kecuali tanpa OTP. Backend menjadikan tenant baru sebagai `activeTenantId` dan mengeluarkan JWT baru. Audit `tenant.self_create`.

**Response 201**

```json
{ "token": "eyJ...", "user": { ... } }
```

**Error**
- 400 — token tidak punya identity.
- 409 — sudah punya tenant `personal` lain (jika type `personal`).

## DELETE `/auth/tenants/:tenantId`

Hapus tenant milik identity (soft delete).

**Side effects**:
- Set `Tenant.deletedAt` + `status='inactive'`.
- Set semua `TenantMember` di tenant tsb. ke `status='inactive', deletedAt=now`.
- Set semua `User` di tenant tsb. ke `status='inactive', whatsappJid=null`.
- Pilih tenant aktif berikutnya untuk identity (membership tertua).
- Audit `tenant.self_delete`.
- Keluarkan JWT baru untuk tenant pengganti.

**Error**
- 403 — bukan owner / bukan member.
- 409 — tenant terakhir milik identity.
- 404 — tenant tidak ditemukan.

## POST `/auth/logout`

Stateless logout. Backend hanya membalas sukses; client membuang token.

**Response 200**

```json
{ "message": "Logout berhasil" }
```

## Catatan implementasi

- Normalisasi nomor WhatsApp dilakukan oleh `normalizeWhatsappNumber` (`utils/phone.js`): semua input akan dipaksa awalan `62`. Lihat fungsi tersebut untuk detail.
- OTP rate limit per nomor diatur oleh `OTP_RATE_LIMIT_*`. Rate limit IP oleh middleware Express.
- Identity yang sudah ada tetapi belum punya membership di tenant manapun (kondisi langka) akan dibantu jika ternyata adalah platform admin (route punya fallback ke `User` legacy dengan role `platform_admin`).

## Lanjut baca

- [Otentikasi & OTP](../../explanation/05-otentikasi-otp.md)
- [Multi-tenant](../../explanation/03-model-multitenant.md)
- [Reference: env OTP](../env-variables.md#otp)
