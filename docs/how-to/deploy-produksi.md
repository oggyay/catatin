# How-to: Deploy ke Produksi

> Kuadran: **How-to** — checklist deploy CatatIN ke server produksi memakai docker compose + reverse proxy HTTPS.

CatatIN paling natural di-deploy via Docker Compose karena sudah disediakan stack 4 service (postgres, redis, backend, frontend). Dokumen ini fokus ke single-host deployment; multi-pod / Kubernetes butuh adaptasi (lihat catatan di akhir).

## Prasyarat

- Server Linux dengan Docker Engine (atau Podman) terinstall.
- Domain + DNS A record menunjuk ke server.
- Sertifikat HTTPS (Let's Encrypt via Caddy / Cloudflare / nginx host).
- (Opsional) Instance WAHA atau akun WA-AKG.
- (Opsional) OpenAI API key.

## Langkah

### 1. Clone repo & checkout tag rilis

```bash
git clone https://github.com/<org>/finapp.git
cd finapp
git checkout <tag-or-main>
```

### 2. Buat `.env` produksi

```bash
cp .env.docker.example .env
nano .env
```

Isi minimal:

```env
# Database
POSTGRES_DB=catatin
POSTGRES_USER=catatin
POSTGRES_PASSWORD=<random-32-chars>

# JWT
JWT_SECRET=<random-64-chars>
JWT_EXPIRES_IN=7d

# Domain
WEB_PORT=8080
APP_BASE_URL=https://catatin.example.com
WEB_BASE_URL=https://catatin.example.com

# WhatsApp - PILIH SALAH SATU
WA_PROVIDER=waha
WAHA_BASE_URL=http://waha:3000     # atau alamat external
WAHA_SESSION=default
WAHA_API_KEY=<dari waha>

# AI parser (opsional)
AI_PARSER_ENABLED=false
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

# Bootstrap admin
PLATFORM_ADMIN_WHATSAPP=628xxx
```

Generate secret aman:

```bash
openssl rand -base64 48   # untuk JWT_SECRET / POSTGRES_PASSWORD
```

### 3. Build & start service

```bash
docker compose up -d --build
docker compose ps
```

Check log:

```bash
docker compose logs -f backend
```

### 4. Jalankan migrasi & seed

Migrasi otomatis lewat `prisma migrate deploy` di start (kalau Dockerfile backend mengikuti pola dengan startup script). Untuk seed pertama kali:

```bash
docker compose exec backend npm run db:seed
```

Akan:
- Buat tenant demo (atau di-skip kalau sudah ada).
- Buat platform admin user dengan nomor `PLATFORM_ADMIN_WHATSAPP`.

### 5. Pasang reverse proxy HTTPS

Pilihan termudah: **Caddy**.

`/etc/caddy/Caddyfile`:

```
catatin.example.com {
  reverse_proxy localhost:8080
}
```

```bash
sudo systemctl reload caddy
```

Caddy akan auto-provision sertifikat Let's Encrypt.

Pilihan lain: nginx + certbot, Cloudflare Tunnel, Traefik, dll.

### 6. Konfigurasi webhook gateway

#### WAHA

Login ke dashboard WAHA → Sessions → set webhook:

```
URL: https://catatin.example.com/api/webhooks/whatsapp
Events: message, message.any
HMAC: opsional
```

Verifikasi:
- Kirim chat test ke nomor yang dipakai WAHA.
- Cek `docker compose logs backend` untuk inbound payload.

#### WA-AKG

Set webhook di dashboard gateway → URL sama: `https://catatin.example.com/api/webhooks/whatsapp`.

### 7. Smoke test

```bash
curl https://catatin.example.com/health
# {"ok":true,"service":"catatin-backend"}

# Buka https://catatin.example.com di browser, login dengan nomor admin (PLATFORM_ADMIN_WHATSAPP)
# OTP akan dikirim ke WhatsApp
```

### 8. Setup backup berkala

`crontab -e`:

```cron
# Backup harian jam 2 pagi
0 2 * * * /usr/local/bin/catatin-backup.sh
```

`/usr/local/bin/catatin-backup.sh`:

```bash
#!/bin/bash
set -e
BACKUP_DIR=/var/backups/catatin
mkdir -p $BACKUP_DIR
docker compose -f /path/to/finapp/docker-compose.yml exec -T postgres \
  pg_dump --format=custom -U catatin catatin \
  > "$BACKUP_DIR/catatin-$(date +%Y%m%d-%H%M%S).dump"
# Hapus backup > 30 hari
find $BACKUP_DIR -name 'catatin-*.dump' -mtime +30 -delete
```

`chmod +x /usr/local/bin/catatin-backup.sh`.

Volume `uploads_data` juga perlu backup terpisah jika fitur upload diaktifkan.

## Checklist post-deploy

- [ ] HTTPS valid (cek di SSL Labs).
- [ ] `https://<domain>/health` return 200.
- [ ] Login lewat web bekerja end-to-end (OTP terkirim ke WA).
- [ ] Bot WA respon command `saldo`, `help`.
- [ ] Backup harian berjalan.
- [ ] Log container terkumpul (gunakan `journalctl` atau ship ke ELK / Loki).
- [ ] Resource (CPU, memory, disk) di-monitor (Grafana, Netdata, dll).

## Update aplikasi

```bash
cd /path/to/finapp
git pull
docker compose up -d --build
# Migrasi otomatis lewat prisma migrate deploy di startup
```

Jika ada perubahan ENV: edit `.env` lalu `docker compose up -d` (compose detect changed env).

## Rollback

```bash
git checkout <previous-tag>
docker compose up -d --build
```

Kalau migrasi sudah ke-apply, rollback DB harus manual — lihat [How-to: rollback migrasi](./rollback-migrasi.md).

## Performance tuning awal

- **Postgres**: tune `shared_buffers`, `work_mem`. Default cukup untuk traffic kecil.
- **Backend**: PM2 / Docker auto-restart. Saat ini tidak ada cluster mode (single Node process).
- **Redis**: enable persistence (sudah default `--appendonly yes`).
- **Nginx frontend**: gzip / brotli sudah opsional; tambahkan di `frontend/nginx.conf`.

## Multi-instance / Kubernetes

Beberapa hal yang perlu disesuaikan:

1. **Webhook dedup** in-memory tidak konsisten antar pod → migrasi dedup ke Redis (`SET NX EX 30`).
2. **Bot processing inline** → consider queue (BullMQ / Redis Streams).
3. **Uploads** → object storage (S3) bukan volume lokal.
4. **JWT_SECRET** harus konsisten antar pod.
5. **DB migration** harus dijalankan dari single source (init container atau job, bukan setiap pod).

Lihat ADR-007 di [keputusan arsitektur](../explanation/09-keputusan-arsitektur.md) untuk konteks.

## Lanjut baca

- [Variabel environment](../reference/env-variables.md).
- [How-to: rollback migrasi](./rollback-migrasi.md).
- [Adapter WhatsApp](../explanation/08-adapter-wa-provider.md).
