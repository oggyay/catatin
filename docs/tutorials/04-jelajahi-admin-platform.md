# Tutorial 4: Menjelajahi Admin Platform

> Kuadran: **Tutorial** — pelajaran end-to-end peran platform admin: lihat tenant, ubah plan, buat tenant, tambah user.

Setelah tutorial ini Anda akan tahu:
- Cara login sebagai platform admin dan navigasi UI khusus admin.
- Cara membuat tenant dengan owner baru lewat UI / API.
- Cara mengubah plan dan trial period tenant.
- Cara menonaktifkan / mengaktifkan tenant.
- Cara melihat usage agregat platform.

Prasyarat: [Tutorial 1](./01-jalankan-lokal.md) selesai. Seed sudah membuat platform admin dengan WA `6289999999999`.

Estimasi waktu: 10 menit.

## Langkah 1 — Login sebagai platform admin

1. Logout dari user demo (kalau masih login).
2. Di halaman login, masukkan: `6289999999999`.
3. Klik **Kirim OTP**.
4. Cek terminal backend untuk OTP plaintext.
5. Masukkan OTP → klik **Verifikasi**.

Anda otomatis di-redirect ke `/admin/tenants` (bukan `/dashboard`). Sidebar berubah menjadi mode admin dengan menu:
- **Tenants**
- **Usage**

User biasa tidak bisa mengakses route ini; admin tidak bisa mengakses route user (otomatis redirect).

## Langkah 2 — Lihat daftar tenant

Halaman **Tenants** menampilkan tabel:

| Tenant | Type | Plan | Status | Trial Ends | Users | Transaksi |
| --- | --- | --- | --- | --- | --- | --- |
| Demo UMKM | umkm | free | trial | (kosong/14 hari) | 1 | beberapa |

Klik baris untuk lihat detail tenant.

## Langkah 3 — Detail tenant

Halaman detail menampilkan:
- Info tenant (nama, type, status, plan).
- Daftar **Users** di tenant.
- Statistik: jumlah user, transaksi, akun, dan pesan WhatsApp inbound.
- Tombol aksi: ubah status, ubah subscription, tambah user.

## Langkah 4 — Ubah plan & trial

1. Di halaman detail tenant, klik **Ubah Subscription**.
2. Pilih:
   - Plan: **basic**.
   - Status: **active**.
   - Trial ends: kosongkan (karena sudah aktif).
3. Klik **Simpan**.

Sekarang tenant punya plan basic — fitur WhatsApp bot otomatis aktif.

> Backend memanggil `PATCH /api/admin/tenants/:id/subscription`. Lihat [API: Admin](../reference/api/admin.md).

## Langkah 5 — Buat tenant baru lewat UI admin

1. Di halaman **Tenants**, klik **+ Buat Tenant**.
2. Isi:
   - Nama: "Toko Demo Kedua".
   - Type: **umkm**.
   - Owner Name: "Owner Kedua".
   - Owner WhatsApp: `6281999888777`.
   - Plan: **free**.
   - Status: **trial**.
   - Trial ends: kosong (default `now + 14 hari`).
3. Klik **Simpan**.

Backend akan:
- Buat tenant baru.
- Buat `AccountIdentity` untuk nomor `6281999888777`.
- Buat `User` proyeksi (role owner).
- Buat `TenantMember`.
- Buat akun default "Kas Tunai" + 15 kategori bawaan.
- Audit log `tenant.admin_create`.

Owner baru sekarang bisa login dengan nomor `6281999888777` lewat OTP biasa.

## Langkah 6 — Tambah user kedua di tenant

1. Klik tenant "Toko Demo Kedua".
2. Klik **+ Tambah User**.
3. Isi:
   - Nama: "Karyawan A".
   - WhatsApp: `6281555444333`.
   - Role: **member**.
4. Klik **Simpan**.

Tenant sekarang punya 2 user. Karyawan ini juga bisa login lewat OTP, tapi role-nya hanya member (tidak bisa kelola user/tenant).

## Langkah 7 — Aktifkan / nonaktifkan tenant

Tombol **Nonaktifkan Tenant** di halaman detail akan:
- Set `Tenant.status = 'inactive'`.
- Semua user di tenant otomatis tidak bisa login (langganan ditolak `requireActiveSubscription`).

Tombol **Aktifkan** untuk balik. Berguna untuk simulasi suspended account.

## Langkah 8 — Lihat usage agregat

Klik menu **Usage** di sidebar. Halaman menampilkan:

- Total tenant.
- Total user.
- Total transaksi.
- Total pesan WhatsApp (inbound + outbound).
- Total pending transaksi WhatsApp.
- Breakdown tenant by type (personal vs umkm).

Endpoint: `GET /api/admin/usage`.

## Langkah 9 — Cek lewat API langsung (opsional)

Token admin bisa dipakai untuk konsumsi REST. Ambil token dari localStorage browser (DevTools → Application → Local Storage → `catatin_token`).

```bash
TOKEN="..."

# Daftar tenant
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/admin/tenants | jq

# Detail tenant
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/admin/tenants/<tenant-id> | jq

# Usage
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/admin/usage | jq
```

## Langkah 10 — Reset link WhatsApp user (use case real)

Kalau user kehilangan akses WA dan butuh re-link, admin bisa reset:

1. Buka tenant detail.
2. Pada baris user, klik **Reset WhatsApp**.
3. Konfirmasi.

Backend memanggil `POST /api/admin/tenants/:tenantId/users/:userId/reset-whatsapp` yang set `whatsappJid = null`. User bisa link ulang lewat menu Settings → WhatsApp di webnya.

## Yang baru saja Anda pelajari

- Platform admin punya UI terpisah dengan guard otomatis di frontend & backend.
- Buat tenant + owner sekaligus + akun default + kategori default.
- Plan & status subscription bisa diubah langsung tanpa flow trial.
- Audit log mencatat operasi penting platform admin.
- Reset WhatsApp adalah pintu pemulihan utama saat user kehilangan akses.

## Apa berikutnya

- [Reference: API admin](../reference/api/admin.md) — integrator yang ingin otomasi.
- [Permissions & roles](../reference/permissions-roles.md) — matriks lengkap.
- [Multi-tenant](../explanation/03-model-multitenant.md) — konteks model identity & member.
- [How-to: deploy ke produksi](../how-to/deploy-produksi.md) — saat siap production.
