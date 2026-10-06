# API: Admin

> Kuadran: **Reference** — endpoint khusus platform admin untuk mengelola tenant & melihat usage. Source: `backend/src/routes/admin.routes.js`.

Base path: `/api/admin`. Semua endpoint butuh `authenticate` + `requirePlatformAdmin`. User dengan `role !== 'platform_admin'` mendapat 403.

## Tenants

### GET `/admin/tenants`

Daftar semua tenant aktif (`deletedAt IS NULL`) + statistik.

**Response 200**

```json
{
  "data": [
    {
      "id": "...",
      "name": "Warung Joni",
      "type": "umkm",
      "status": "active",
      "subscriptionPlan": "basic",
      "subscriptionStatus": "active",
      "trialEndsAt": null,
      "deletedAt": null,
      "usersCount": 3,
      "transactionsCount": 245,
      "createdAt": "..."
    }
  ]
}
```

Order: `createdAt DESC`.

### POST `/admin/tenants`

Buat tenant + owner pertama.

**Request body**

```json
{
  "name": "Toko Baru",
  "type": "umkm",
  "ownerName": "Pak Owner",
  "ownerWhatsappNumber": "081xxx",
  "subscriptionPlan": "basic",
  "subscriptionStatus": "active",
  "trialEndsAt": null
}
```

| Field | Tipe | Wajib | Default |
| --- | --- | --- | --- |
| `name` | string ≥ 2 | ya | - |
| `type` | `personal`/`umkm` | tidak (default `personal`) | |
| `ownerName` | string ≥ 2 | ya | |
| `ownerWhatsappNumber` | string ≥ 6 | ya | dinormalisasi |
| `subscriptionPlan` | `free`/`basic`/`pro` | tidak | `free` |
| `subscriptionStatus` | `active`/`suspended`/`trial`/`inactive` | tidak | `trial` |
| `trialEndsAt` | ISO datetime / null | tidak | `now + 14 hari` (kalau tidak di-set) |

**Side effects**:
- Buat tenant + identity owner + user proyeksi + TenantMember.
- Buat akun "Kas Tunai" + default categories.
- Audit `tenant.admin_create`.

**Error**
- 409 — nomor owner sudah terdaftar.

### GET `/admin/tenants/:id`

Detail tenant + daftar user + jumlah pesan WA inbound.

**Response 200**

```json
{
  "data": {
    "id": "...",
    "name": "...",
    "type": "umkm",
    "status": "active",
    "subscriptionPlan": "...",
    "subscriptionStatus": "...",
    "trialEndsAt": null,
    "createdAt": "...",
    "updatedAt": "...",
    "users": [
      { "id": "...", "name": "...", "whatsappNumber": "...", "whatsappJid": "...", "role": "...", "status": "...", "deletedAt": null }
    ],
    "_count": { "users": 3, "transactions": 245, "accounts": 4 },
    "whatsappCommandCount": 612
  }
}
```

`whatsappCommandCount` = jumlah `WhatsappLog` dengan `direction='inbound'` untuk tenant tersebut.

### PATCH `/admin/tenants/:id/status`

Aktifkan / nonaktifkan tenant.

**Request body**

```json
{ "status": "active" }
```

Pilihan: `active`, `inactive`. Inactive akan menolak request user (lihat `requireActiveSubscription`).

### DELETE `/admin/tenants/:id`

Soft delete tenant.

**Side effects**:
- `Tenant.deletedAt = now`, `status='inactive'`.
- Semua `User` di tenant set `status='inactive', whatsappJid=null`.
- Audit `platform_admin.tenant.delete`.

### PATCH `/admin/tenants/:id/subscription`

Ubah plan / status / trial end.

**Request body** (opsional)

```json
{
  "subscriptionPlan": "pro",
  "subscriptionStatus": "active",
  "trialEndsAt": null
}
```

`trialEndsAt`: kirim string ISO untuk set, `null` untuk hapus.

## Users (oleh platform admin)

### POST `/admin/tenants/:tenantId/users`

Buat user baru di tenant tertentu.

**Request body**

```json
{ "name": "...", "whatsappNumber": "081xxx", "role": "admin" }
```

`role` boleh `owner`/`admin`/`member` (default `member`). Reuse identity jika nomor sudah ada di sistem.

**Side effects**: buat User + TenantMember + (re)activate identity. Audit `platform_admin.user.create`.

### PATCH `/admin/tenants/:tenantId/users/:userId`

Update role / status user.

**Request body** (opsional)

```json
{ "role": "admin", "status": "inactive" }
```

**Aturan**:
- Demote owner / deactivate owner butuh `ownerCount > 1`.
- Update mirror ke `TenantMember`.
- Re-activate user juga me-activate identity dan set `activeTenantId` ke tenant ini.

Audit `platform_admin.user.update`.

### POST `/admin/tenants/:tenantId/users/:userId/reset-whatsapp`

Reset link WhatsApp user (set `whatsappJid = null`). Berguna saat user kehilangan akses WA.

**Side effects**: User update + audit `platform_admin.user.reset_whatsapp`.

### DELETE `/admin/tenants/:tenantId/users/:userId`

Soft-delete user di tenant.

**Aturan**: owner aktif terakhir tidak bisa dihapus → 409.

**Side effects** sama dengan `DELETE /settings/users/:id`. Audit `platform_admin.user.delete`.

## Usage

### GET `/admin/usage`

Statistik agregat seluruh platform.

**Response 200**

```json
{
  "data": {
    "tenants": 42,
    "users": 87,
    "transactions": 12453,
    "whatsappLogs": 2891,
    "whatsappPendings": 14,
    "tenantsByType": [
      { "type": "personal", "count": 18 },
      { "type": "umkm", "count": 24 }
    ]
  }
}
```

Catatan: `tenants` mencakup yang soft-deleted (count semua); jika perlu hanya aktif, filter manual di frontend.

## Lanjut baca

- [Permissions & roles](../permissions-roles.md).
- [Multi-tenant](../../explanation/03-model-multitenant.md).
- [How-to: deploy ke produksi](../../how-to/deploy-produksi.md) — termasuk seed platform admin.
