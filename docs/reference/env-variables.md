# Variabel Environment

> Kuadran: **Reference** — daftar lengkap variabel ENV untuk backend + docker compose, default, dan dampaknya.

Backend membaca ENV via `dotenv` di `src/server.js:1`. File template tersedia di:
- `backend/.env.example` — untuk development lokal (`npm run dev`).
- `.env.docker.example` (root repo) — untuk `docker compose up`.

## Server

| Variabel | Default | Deskripsi |
| --- | --- | --- |
| `PORT` | `4000` | Port HTTP backend. |
| `NODE_ENV` | `development` | `production` mengaktifkan format log Morgan combined dan sembunyikan stack di error response. |
| `APP_BASE_URL` | `http://localhost:4000` | URL backend (untuk webhook external mengarah ke sini). |
| `WEB_BASE_URL` | `http://localhost:5173` (dev) / `http://localhost:8080` (docker) | URL frontend; dipakai untuk redirect/email link di masa depan. |
| `LOG_LEVEL` | (kosong) | Set `error` atau `silent` untuk mematikan log Morgan & beberapa log info. |

## Database

| Variabel | Default | Deskripsi |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://admin:admin123@localhost:5432/db?schema=public` | Connection string Prisma. |

Untuk docker compose: dirakit otomatis dari `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`.

| Variabel docker | Default | Deskripsi |
| --- | --- | --- |
| `POSTGRES_DB` | `catatin` | Nama database. |
| `POSTGRES_USER` | `catatin` | DB user. |
| `POSTGRES_PASSWORD` | `catatin_dev_password` | **Wajib diganti di production**. |

## Redis

| Variabel | Default | Deskripsi |
| --- | --- | --- |
| `REDIS_URL` | `redis://localhost:6379` (dev) / `redis://redis:6379` (docker) | Wajib di-set; OTP dan link cache butuh Redis. |

## JWT

| Variabel | Default | Deskripsi |
| --- | --- | --- |
| `JWT_SECRET` | `change-me-super-secret` | **Wajib diganti di production**. Mengganti membatalkan semua token aktif. |
| `JWT_EXPIRES_IN` | `7d` | Format `jsonwebtoken` (`7d`, `12h`, `30m`, dll). |

## OTP

Lihat [Otentikasi & OTP](../explanation/05-otentikasi-otp.md) untuk konteks.

| Variabel | Default | Deskripsi |
| --- | --- | --- |
| `OTP_LENGTH` | `6` | Panjang digit OTP. |
| `OTP_EXPIRES_MINUTES` | `5` | TTL OTP di Redis. |
| `OTP_MAX_ATTEMPTS` | `5` | Maks salah masukkan kode sebelum 429. |
| `OTP_RATE_LIMIT_COUNT` | `3` | Maks request OTP per nomor di jendela. |
| `OTP_RATE_LIMIT_WINDOW_MINUTES` | `15` | Jendela rate limit nomor. |

> Backend juga menerima nama lama `OTP_RATE_LIMIT_PER_HOUR` untuk kompatibilitas (`otp.service.js:14`).

## WhatsApp Provider

| Variabel | Default | Deskripsi |
| --- | --- | --- |
| `WA_PROVIDER` | `mock` | `mock` / `waha` / `wa-akg` (alias `waakg`). |

### WAHA

| Variabel | Default | Deskripsi |
| --- | --- | --- |
| `WAHA_BASE_URL` | `http://localhost:3000` | URL container WAHA. Di docker compose default `http://host.containers.internal:3000`. |
| `WAHA_SESSION` | `default` | Session WAHA. |
| `WAHA_API_KEY` | (kosong) | Header `X-Api-Key` jika WAHA pakai auth. |
| `WAHA_SEND_SEEN` | (kosong → enabled) | Set `false` untuk skip mark-as-seen. |
| `WAHA_TYPING_ENABLED` | (kosong → enabled) | Set `false` untuk mematikan typing indicator. |
| `WAHA_TYPING_DELAY_MS` | `700` | Delay typing sebelum kirim text. Maks 3000ms (clamp). |

### WA-AKG

| Variabel | Default | Deskripsi |
| --- | --- | --- |
| `WA_AKG_BASE_URL` | (kosong) | Endpoint gateway. |
| `WA_AKG_API_KEY` | (kosong) | Bearer token. |
| `WA_AKG_DEVICE_ID` | (kosong) | Device id (opsional, dikirim sebagai field `device`). |

### Meta-style verification (opsional)

| Variabel | Default | Deskripsi |
| --- | --- | --- |
| `WA_WEBHOOK_VERIFY_TOKEN` | (kosong) | Token verifikasi untuk `GET /api/webhooks/whatsapp` style Meta. |

## AI Parser

| Variabel | Default | Deskripsi |
| --- | --- | --- |
| `AI_PARSER_ENABLED` | `false` | `true` mengaktifkan fallback ke OpenAI saat heuristic confidence < high. |
| `OPENAI_API_KEY` | (kosong) | Wajib jika `AI_PARSER_ENABLED=true`. |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model OpenAI yang dipanggil. |

> `.env.example` di repo berisi key contoh; **jangan reuse di production**. Selalu generate key sendiri.

## WhatsApp Pending Confirmation

| Variabel | Default | Deskripsi |
| --- | --- | --- |
| `WA_PENDING_EXPIRES_MINUTES` | `10` | TTL transaksi pending (menunggu YA/BATAL). |

## Upload

| Variabel | Default | Deskripsi |
| --- | --- | --- |
| `UPLOAD_DIR` | `./uploads` (dev) / `/app/uploads` (docker) | Direktori penyimpanan attachment. |
| `MAX_UPLOAD_MB` | `5` | Limit ukuran upload. (Saat ini hanya dipakai untuk konfigurasi; multer di kode menerima default 5MB.) |

## Bootstrap & Seed

| Variabel | Default | Deskripsi |
| --- | --- | --- |
| `PLATFORM_ADMIN_WHATSAPP` | `6289999999999` (saat seed) | Nomor platform admin yang dibuat oleh `npm run db:seed`. |
| `DEMO_USER_WHATSAPP` | `6281234567890` (saat seed) | Owner demo tenant "Demo UMKM". |

## Frontend

| Variabel | Default | Deskripsi |
| --- | --- | --- |
| `VITE_API_PROXY` | `http://localhost:4000` | Target proxy `/api` dan `/uploads` saat `npm run dev`. |

## Docker compose tambahan

| Variabel | Default | Deskripsi |
| --- | --- | --- |
| `WEB_PORT` | `8080` | Port host yang expose nginx frontend. |

## Checklist production

Sebelum `docker compose up -d --build` di production:

- [ ] Ganti `POSTGRES_PASSWORD` ke nilai random panjang.
- [ ] Ganti `JWT_SECRET` ke nilai random panjang (≥ 32 karakter).
- [ ] Set `APP_BASE_URL` dan `WEB_BASE_URL` ke domain HTTPS.
- [ ] Set `WA_PROVIDER` ke `waha` atau `wa-akg` (jangan `mock`).
- [ ] Konfigurasi credential gateway (WAHA / AKG).
- [ ] Putuskan `AI_PARSER_ENABLED`. Kalau `true`, isi `OPENAI_API_KEY`.
- [ ] Set webhook gateway → `https://<domain>/api/webhooks/whatsapp`.
- [ ] HTTPS termination di reverse proxy depan (Caddy / Cloudflare / Nginx host).

## Lanjut baca

- [How-to: deploy ke produksi](../how-to/deploy-produksi.md).
- [Adapter provider WhatsApp](../explanation/08-adapter-wa-provider.md).
