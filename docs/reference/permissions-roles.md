# Permissions & Roles

> Kuadran: **Reference** — daftar role yang ada, dan operasi apa yang masing-masing diizinkan / dilarang.

CatatIN punya empat role di enum `UserRole`: `owner`, `admin`, `member`, `platform_admin`.

- Tiga pertama hidup dalam konteks tenant; mereka diatur lewat `TenantMember.role`.
- `platform_admin` adalah role pada `User` itu sendiri (bukan member tenant) — dipakai oleh tim CatatIN untuk operasi lintas tenant.

## Definisi singkat

| Role | Peran | Sumber |
| --- | --- | --- |
| `owner` | Pemilik tenant. Punya kendali penuh. | `TenantMember.role` |
| `admin` | Wakil owner di tenant tertentu. Tidak bisa mengubah owner. | `TenantMember.role` |
| `member` | Pengguna biasa: bisa transaksi tapi tidak mengelola user. | `TenantMember.role` |
| `platform_admin` | Tim CatatIN. Bisa mengakses semua tenant via `/api/admin/*`. | `User.role` |

## Matriks operasi tenant-level

Untuk endpoint di tenant aktif user (`/api/...` non-admin):

| Operasi | owner | admin | member |
| --- | :---: | :---: | :---: |
| Lihat dashboard, transaksi, akun, kategori, laporan | ✓ | ✓ | ✓ |
| CRUD transaksi (sendiri & user lain di tenant) | ✓ | ✓ | ✓ |
| Transfer antar akun | ✓ | ✓ | ✓ |
| Void transaksi | ✓ | ✓ | ✓ |
| CRUD akun & kategori | ✓ | ✓ | ✓ |
| Adjust balance akun | ✓ | ✓ | ✓ |
| Edit profil sendiri | ✓ | ✓ | ✓ |
| Lihat & edit info tenant | ✓ | ✓ | ✗ |
| Lihat daftar user tenant | ✓ | ✓ | ✗ |
| Tambah user (role owner/member) | ✓ | ✗ | ✗ |
| Tambah user (role admin/member) | ✗ | ✓ | ✗ |
| Edit role/status user | ✓ | ✓ (kecuali owner) | ✗ |
| Hapus user | ✓ | ✓ (kecuali owner) | ✗ |
| Edit/aktifkan WhatsApp link sendiri | ✓ | ✓ | ✓ (jika plan support) |
| Buat/hapus tenant lewat self-service | ✓ identity-level (lintas peran) | – | – |

> Catatan: tombol "Buat tenant baru" tersedia untuk semua user yang punya identity, terlepas dari role di tenant aktif (lihat `auth.routes.js:384-488`). Hapus tenant hanya boleh oleh owner di tenant tersebut.

## Aturan terkait owner

- **Minimal satu owner aktif per tenant.** Demote, deactivate, atau hapus owner yang menyebabkan jumlah owner aktif menjadi 0 → 409.
- **Self-locking dicegah.** User tidak bisa mengubah role/status dirinya sendiri (`settings.routes.js:487-493`).
- **Admin tidak bisa menyentuh owner.** Tidak bisa edit role/status, tidak bisa hapus.

## Aturan platform admin

`platform_admin` ditentukan oleh `User.role === 'platform_admin'`, bukan dari `TenantMember`. Konsekuensi:

- Mereka login lewat OTP nomor mereka — biasanya `User.tenantId` null (tidak terikat tenant).
- Frontend mendeteksi `user.role === 'platform_admin'` dan **memaksa** mereka ke `/admin/tenants` (lihat `App.jsx:24-26`).
- Endpoint `/api/admin/*` membutuhkan `requirePlatformAdmin`. Endpoint user biasa **tidak mengembalikan 403** kalau dipanggil platform admin, tapi guard frontend mencegah navigasi ke sana.

Bisa platform admin punya tenant juga? Secara skema bisa, tapi flow login otomatis akan mengarahkan ke admin panel. Kalau perlu mode "admin yang juga punya tenant", perlu modifikasi guard.

## Cara guard di-implementasi

### Backend

```js
// middleware/auth.js
authenticate            // wajib JWT valid
requireTenant           // req.tenantId harus ada
requireActiveSubscription // tenant active + subscription tidak suspended/expired
requirePlatformAdmin    // req.user.role === 'platform_admin'
requireRole(...roles)   // generic checker (jarang dipakai langsung)
```

Tiap router me-mount kombinasi:

```js
// dashboard.routes.js
router.use(authenticate, requireTenant, requireActiveSubscription);

// admin.routes.js
router.use(authenticate, requirePlatformAdmin);

// settings.routes.js — sebagian besar
router.use(authenticate, requireTenant);  // tanpa requireActiveSubscription
```

Beberapa endpoint di `settings.routes.js` (misalnya `link-request`) memanggil `ensureSubscriptionUsable` per request alih-alih guard global, untuk memberi pesan error spesifik.

### Frontend

- `Protected` di `App.jsx` mengecek `user`/`platformAdmin`.
- Item nav settings dengan `roles: ['owner', 'admin']` hanya tampil bagi role tersebut.
- Tombol "Tambah user" / "Edit user" mungkin terlihat oleh member karena UI tidak selalu hide; namun backend menolak.

> Saat redesign, **disarankan** menambah hide tombol mutasi user di sisi UI berdasarkan role untuk mengurangi friction.

## Berinteraksi dengan multi-tenant

Karena identity bisa punya membership di banyak tenant dengan role berbeda:

- Role di tenant A bisa `owner`, di tenant B bisa `member`.
- JWT membawa role dari **`TenantMember` di tenant aktif**, sehingga role berlaku per session aktif.
- Switch tenant → JWT baru → role efektif berubah.

## Tips redesign

- **Audit endpoint baru**: pastikan setiap endpoint baru di-mount dengan kombinasi guard yang benar. Lihat [How-to: tambah endpoint](../how-to/tambah-endpoint-api.md).
- **Hindari hardcode role list di banyak tempat**. Saat ini `allowedManagedRoles` ada di `settings.routes.js`. Ekstrak ke `config/permissions.js` jika matriks bertambah.
- **Pertimbangkan role baru** seperti `accountant` (read-only) dengan menambah enum + mengupdate matriks.

## Lanjut baca

- [Multi-tenant](../explanation/03-model-multitenant.md).
- [API: Settings](./api/settings.md) — endpoint tunduk role.
- [API: Admin](./api/admin.md) — platform admin only.
- [Error codes](./error-codes.md) — daftar 403 yang muncul.
