# Tutorial 1: Jalankan CatatIN di Lokal

> Kuadran: **Tutorial** — pelajaran terstruktur dari clone repo sampai berhasil login di dashboard. Fokus pada hasil yang pasti, bukan teori.

Setelah menyelesaikan tutorial ini Anda akan punya:
- Backend CatatIN berjalan di `http://localhost:4000`.
- Frontend berjalan di `http://localhost:5173`.
- Database PostgreSQL terisi data demo + akun admin.
- Login berhasil ke dashboard demo "Demo UMKM".

Estimasi waktu: 15 menit.

## Prasyarat

- Node.js 18 atau lebih baru (`node --version`).
- PostgreSQL 14+ berjalan di lokal atau pakai Docker.
- Redis 6+ berjalan (atau pakai Docker).
- Git.

Cara cepat menyalakan Postgres + Redis lewat Docker (kalau belum):

```bash
docker run -d --name catatin-pg \
  -e POSTGRES_USER=admin -e POSTGRES_PASSWORD=admin123 -e POSTGRES_DB=db \
  -p 5432:5432 postgres:16-alpine

docker run -d --name catatin-redis \
  -p 6379:6379 redis:7-alpine
```

## Langkah 1 — Clone repo

```bash
git clone https://github.com/<org>/finapp.git
cd finapp
```

Verifikasi struktur:

```
finapp/
├── backend/
├── frontend/
├── mobile/
├── docs/
├── docker-compose.yml
└── README.md
```

## Langkah 2 — Setup backend

```bash
cd backend
cp .env.example .env
```

Edit `.env` minimal:

```env
DATABASE_URL=postgresql://admin:admin123@localhost:5432/db?schema=public
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-change-me
WA_PROVIDER=mock
AI_PARSER_ENABLED=false
```

Install dependency dan migrasi DB:

```bash
npm install
npx prisma migrate dev --name init
```

Anda akan melihat output seperti:

```
Applying migration `20260511125113_init`
... (migrasi lainnya)
Your database is now in sync with your schema.
```

## Langkah 3 — Seed data demo

```bash
npm run db:seed
```

Output:

```
Seeding CatatIN...
  Demo user WA:      6281234567890
  Platform admin WA: 6289999999999
  Demo tenant dibuat: ...
  Platform admin dibuat.
Seed selesai.
```

Sekarang Anda punya:
- Tenant "Demo UMKM" dengan owner WA `6281234567890`.
- Platform admin user dengan WA `6289999999999`.
- Akun "Kas Tunai" + 15 kategori bawaan.

## Langkah 4 — Jalankan backend

```bash
npm run dev
```

Output:

```
CatatIN backend running on http://localhost:4000
  WA provider: mock
  AI parser:   disabled
```

Tes health check:

```bash
curl http://localhost:4000/health
# {"ok":true,"service":"catatin-backend"}
```

Biarkan terminal ini terbuka.

## Langkah 5 — Setup frontend (terminal baru)

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Output:

```
VITE v5  ready in 800 ms
➜  Local:   http://localhost:5173/
```

Buka `http://localhost:5173` di browser. Anda akan melihat halaman login.

## Langkah 6 — Login ke dashboard

1. Di halaman login, masukkan nomor WhatsApp demo:

   ```
   6281234567890
   ```

2. Klik **Kirim OTP**.

3. Pindah ke terminal **backend**. Anda akan melihat OTP plaintext (mode mock):

   ```
   ================ [MOCK WA SEND] ================
   To     : 6281234567890
   Message: Kode OTP Anda: *847291*
   Berlaku 5 menit.
   Jangan bagikan kode ini ke siapapun.

   — CatatIN
   ================================================
   ```

4. Copy kode OTP, paste di form verifikasi di browser. Klik **Verifikasi**.

5. Anda akan masuk ke dashboard "Demo UMKM" dengan KPI kosong (belum ada transaksi).

## Langkah 7 — Buat transaksi pertama (smoke test)

1. Klik tombol **+ Tambah Transaksi** di dashboard.
2. Pilih:
   - Tipe: **Pengeluaran**.
   - Akun: **Kas Tunai**.
   - Kategori: **Makan**.
   - Nominal: `50000`.
   - Keterangan: "test pertama".
3. Klik **Simpan**.

Toast hijau akan muncul. Saldo Kas Tunai berubah jadi `-Rp50.000` (karena saldo awal 0).

## Langkah 8 — Test bot WhatsApp via webhook

Tanpa keluar dari mode mock, simulasikan WhatsApp masuk:

```bash
curl -X POST http://localhost:4000/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"from":"6281234567890","body":"saldo"}'
```

Cek terminal backend — bot akan membalas:

```
================ [MOCK WA SEND] ================
To     : 6281234567890
Message: Saldo Anda saat ini:

Total: -Rp50.000

Kas Tunai: -Rp50.000
================================================
```

> Jika balasan adalah `Fitur WhatsApp tersedia mulai plan Basic.`, upgrade plan demo tenant lewat SQL:
>
> ```sql
> UPDATE "Tenant" SET "subscriptionPlan" = 'basic' WHERE name = 'Demo UMKM';
> ```

## Langkah 9 — Login sebagai platform admin

1. Logout dari dashboard.
2. Login dengan nomor `6289999999999`.
3. Cek terminal untuk OTP, masukkan.
4. Anda akan masuk ke `/admin/tenants`.

Di sini Anda bisa lihat statistik tenant, ubah status, ubah plan, dan tambah user.

## Selamat!

Anda sudah punya environment development penuh dengan:
- Backend, frontend, dan mobile (kalau ingin lanjut).
- Data demo + admin.
- Bot WhatsApp simulasi via mock provider.

## Apa berikutnya

- [Tutorial 2: buat transaksi pertama lewat web](./02-buat-transaksi-pertama.md) — pelajari fitur-fitur transaksi lebih lanjut.
- [Tutorial 3: coba bot WhatsApp tanpa gateway](./03-coba-bot-whatsapp-mock.md) — eksplorasi command bot.
- [Tutorial 4: jelajahi admin platform](./04-jelajahi-admin-platform.md).
- [How-to: tambah endpoint API](../how-to/tambah-endpoint-api.md) — kalau sudah siap modify backend.

## Troubleshooting

### `Error: connect ECONNREFUSED 127.0.0.1:5432`
Postgres tidak berjalan. Jalankan container Docker (lihat Prasyarat) atau service Postgres lokal.

### `Error: connect ECONNREFUSED 127.0.0.1:6379`
Redis tidak berjalan. Jalankan container Redis.

### `Migration failed: ...`
DB belum kosong. Jalankan `npm run db:reset` (akan drop semua tabel).

### OTP tidak muncul di console
Pastikan `WA_PROVIDER=mock` di `.env` dan `LOG_LEVEL` tidak di-set ke `silent`/`error`.

### Frontend menampilkan "Memuat..." terus
Backend tidak respond. Cek terminal backend untuk error. Cek `VITE_API_PROXY` di frontend `.env` (default `http://localhost:4000`).
