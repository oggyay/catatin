# API: Settings

> Kuadran: **Reference** — profil user, info tenant, manajemen user, link WhatsApp, info subscription. Source: `backend/src/routes/settings.routes.js`.

Base path: `/api/settings`. Semua endpoint butuh `authenticate` + `requireTenant`. Beberapa endpoint juga butuh role tertentu (owner/admin) atau langganan aktif.

## Profil

### GET `/settings/profile`

Profil user di tenant aktif.

**Response 200**

```json
{
  "data": {
    "id": "ck",
    "name": "Joni",
    "whatsappNumber": "6281234567890",
    "whatsappJid": "6281234567890@c.us",
    "whatsappLinked": true,
    "role": "owner"
  }
}
```

### PATCH `/settings/profile`

Update profil sendiri.

**Request body** (semua opsional)

```json
{ "name": "Joni Setiawan", "whatsappNumber": "081234567899" }
```

- `whatsappNumber` di-normalisasi otomatis.
- Nomor baru tidak boleh sudah dipakai user lain → 409.

**Response 200** — record User terbaru.

## Tenant

### GET `/settings/tenant`

Detail tenant aktif (raw record).

### PATCH `/settings/tenant`

Update nama / type tenant. Hanya `owner` atau `admin`.

**Request body** (opsional)

```json
{ "name": "Warung Joni Pusat", "type": "umkm" }
```

- Jika ubah `type` ke `personal`, identity tidak boleh sudah punya tenant `personal` lain → 409.

## Subscription info

### GET `/settings/subscription`

Info plan + usage saat ini untuk halaman `/settings/subscription` di frontend.

**Response 200**

```json
{
  "data": {
    "tenant": {
      "id": "...",
      "name": "Warung Joni",
      "type": "umkm",
      "status": "active",
      "subscriptionPlan": "basic",
      "subscriptionStatus": "active",
      "trialEndsAt": null,
      "trialExpired": false
    },
    "limits": { "maxUsers": 3, "maxAccounts": 5, "whatsappBot": true },
    "usage": { "users": 2, "accounts": 4 }
  }
}
```

`limits` berasal dari `getPlanLimits(type, plan)` (`config/plans.js`). `trialExpired` true jika `subscriptionStatus='trial'` dan `trialEndsAt < now`.

## Users (manajemen user di tenant)

Owner & admin saja. Lihat [Permissions & Roles](../permissions-roles.md) untuk matriks lengkap.

### GET `/settings/users`

Daftar user aktif tenant. Role/status diambil dari `TenantMember` (jika ada), fallback ke field `User`.

**Response 200**

```json
{
  "data": [
    { "id": "...", "name": "...", "whatsappNumber": "...", "role": "owner", "status": "active", "createdAt": "...", "deletedAt": null }
  ]
}
```

### POST `/settings/users`

Tambah user.

**Request body**

```json
{ "name": "Andi", "whatsappNumber": "081222333", "role": "member" }
```

| Field | Tipe | Wajib | Catatan |
| --- | --- | --- | --- |
| `name` | string ≥ 2 | ya | |
| `whatsappNumber` | string ≥ 6 | ya | dinormalisasi |
| `role` | `owner`/`admin`/`member` | tidak (default `member`) | dibatasi `allowedManagedRoles` |

**Aturan role** (`settings.routes.js:31-35`):
- Owner boleh assign role: `owner`, `member`. Tidak boleh assign `admin` (admin hanya dibuat oleh platform admin).
- Admin boleh assign role: `admin`, `member`.

**Side effects**:
- Cek limit `maxUsers`. Jika penuh → 403.
- Reuse `AccountIdentity` jika nomor sudah ada (lintas tenant); kalau belum, buat baru.
- Buat `User` proyeksi + `TenantMember` (upsert).

**Error**
- 403 — role tidak diizinkan / langganan tidak aktif.
- 409 — nomor sudah jadi user di tenant ini.

### PATCH `/settings/users/:id`

Update role / status user.

**Request body** (opsional)

```json
{ "name": "Andi Permana", "role": "admin", "status": "inactive" }
```

**Aturan**:
- Tidak bisa ubah role/status diri sendiri (hindari self-lock).
- Admin tidak bisa ubah owner.
- Demote owner / deactivate owner butuh `ownerCount > 1` (409 kalau owner aktif tinggal satu).
- Update di-mirror ke `TenantMember` (transaksional).

### DELETE `/settings/users/:id`

Soft-delete user di tenant.

**Aturan**:
- Tidak bisa hapus diri sendiri.
- Admin tidak bisa hapus owner.
- Owner aktif terakhir tidak bisa dihapus.

**Side effects** (atomik):
- `User.deletedAt = now`, `status='inactive'`.
- `whatsappNumber` digantikan marker `deleted:{userId}:{nomor}` (untuk kompatibilitas unique).
- `deletedWhatsappNumber` simpan nilai asli.
- `whatsappJid = null`.
- `TenantMember` di-set inactive.
- Audit `user.delete`.

## WhatsApp link

### GET `/settings/whatsapp`

Status link + token/request aktif (untuk halaman Settings WhatsApp di frontend).

**Response 200**

```json
{
  "data": {
    "whatsappNumber": "6281234567890",
    "whatsappJid": "6281234567890@c.us",
    "linked": true,
    "activeToken": { "token": "CATATIN-123456", "expiresAt": "..." } | null,
    "activeRequest": { "id": "...", "whatsappNumber": "...", "expiresAt": "...", "status": "pending" } | null
  }
}
```

### POST `/settings/whatsapp/link-request`

Kirim pesan konfirmasi ke nomor user; user balas `YA`/`BATAL` di WA. Lihat [Otentikasi & OTP](../../explanation/05-otentikasi-otp.md#hubungkan-whatsapp-ke-akun-link-flow).

**Aturan**:
- User belum linked (`whatsappJid === null`).
- Plan harus mendukung WhatsApp bot (`whatsappBot: true`).
- Langganan aktif.

**Side effects**:
- Cancel link request lama (set `status='cancelled'`).
- Buat `WhatsappLinkRequest` baru (TTL 5 menit).
- Cache di Redis `wa:link-request:{number}` untuk lookup cepat oleh bot.
- Kirim pesan WA "Konfirmasi hubungkan…" via `sendWhatsapp`.

**Response 201**

```json
{ "data": { "id": "...", "whatsappNumber": "...", "expiresAt": "...", "status": "pending" } }
```

**Error**
- 403 — plan tidak support / langganan tidak aktif.
- 409 — sudah linked.
- 502 — gagal kirim WhatsApp (request langsung di-cancel).

### DELETE `/settings/whatsapp/link-request`

Cancel link request aktif.

**Response 200** — `{ "data": { "ok": true } }`.

### POST `/settings/whatsapp/link-token`

Buat token `CATATIN-XXXXXX`. User mengetik `link CATATIN-XXXXXX` di WhatsApp untuk linking.

**Side effects**:
- Mark token lama (`usedAt: now`).
- Generate token baru (max 3 retry kalau collision).
- TTL 10 menit.

**Response 201**

```json
{ "data": { "token": "CATATIN-123456", "expiresAt": "..." } }
```

### DELETE `/settings/whatsapp/link`

Putuskan link (set `whatsappJid = null` di User).

**Response 200**

```json
{ "data": { "whatsappNumber": "...", "whatsappJid": null, "linked": false } }
```

## Lanjut baca

- [Permissions & roles](../permissions-roles.md).
- [Otentikasi & OTP](../../explanation/05-otentikasi-otp.md).
- [Plan limits](../env-variables.md) — lihat juga `backend/src/config/plans.js`.
