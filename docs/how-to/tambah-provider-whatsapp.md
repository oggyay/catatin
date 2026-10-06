# How-to: Tambah Provider WhatsApp Baru

> Kuadran: **How-to** — menambahkan adapter untuk gateway WhatsApp baru (mis. Twilio, Wablas, Fonnte) atau service messaging lain yang ingin di-integrasikan.

## Resep

### 1. Buat file provider

`backend/src/services/whatsapp/<name>.provider.js`:

```js
/**
 * Foo gateway provider.
 * Endpoint: POST {FOO_BASE_URL}/api/messages
 * Auth: Authorization: Bearer ${FOO_API_KEY}
 */
export const fooProvider = {
  name: 'foo',
  async send(to, message) {
    const baseUrl = process.env.FOO_BASE_URL;
    const apiKey = process.env.FOO_API_KEY;

    if (!baseUrl) throw new Error('FOO_BASE_URL belum di-set');
    if (!apiKey) throw new Error('FOO_API_KEY belum di-set');

    const url = `${baseUrl.replace(/\/$/, '')}/api/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        to: String(to).replace(/[^\d]/g, ''),
        text: message,
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Foo provider failed ${res.status}: ${t}`);
    }
    const data = await res.json().catch(() => ({}));
    return { ok: true, provider: 'foo', data };
  },
};
```

Wajib:
- Properti `name` string.
- Method `send(to, message)` async, return `{ ok, provider, data? }` saat sukses, throw `Error` saat gagal.
- Throw `Error` dengan pesan jelas — wrapper `sendWhatsapp` akan log + (di dev) fallback console.

### 2. Daftar di selektor

Edit `backend/src/services/whatsapp/index.js`:

```js
import { mockProvider } from './mock.provider.js';
import { wahaProvider } from './waha.provider.js';
import { waAkgProvider } from './waakg.provider.js';
import { fooProvider } from './foo.provider.js';   // <-- baru

function getProvider() {
  const name = (process.env.WA_PROVIDER || 'mock').toLowerCase();
  switch (name) {
    case 'waha':    return wahaProvider;
    case 'wa-akg':
    case 'waakg':   return waAkgProvider;
    case 'foo':     return fooProvider;  // <-- baru
    case 'mock':
    default:        return mockProvider;
  }
}
```

### 3. Update env config

Edit `backend/.env.example`:

```
# Foo provider
FOO_BASE_URL=
FOO_API_KEY=
```

Dan `.env.docker.example` di root repo. Tambahkan ke `docker-compose.yml` jika perlu:

```yaml
services:
  backend:
    environment:
      FOO_BASE_URL: ${FOO_BASE_URL:-}
      FOO_API_KEY: ${FOO_API_KEY:-}
```

### 4. Update parsing webhook (jika format inbound berbeda)

Edit `backend/src/routes/webhooks.routes.js` di `extractPayload`:

```js
// Foo gateway sends: { senderNumber, body, msgId }
const from = b.from || b.sender || b.number || b.phone || b.msisdn || b.waNumber || b.senderNumber;
const body = b.body || b.message || b.text || b.content || b.msg;
// ... messageId handling
```

Atau tambahkan handler khusus untuk shape yang sangat berbeda (lihat `extractPayload` untuk WAHA-style sebagai contoh).

### 5. Konfigurasi webhook gateway

Setting di provider:

```
POST {YOUR_DOMAIN}/api/webhooks/whatsapp
```

Gunakan rate limit 120/menit. Pastikan response 200 OK ditangkap (CatatIN sudah otomatis 200 untuk semua kasus).

### 6. Test mengirim

Pakai mode `WA_PROVIDER=foo` di `.env`, restart backend, lalu trigger OTP atau bot. Cek log provider untuk error.

```bash
curl -X POST http://localhost:4000/api/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"whatsappNumber":"6281234567890"}'
```

### 7. Test menerima

Simulate webhook gateway:

```bash
curl -X POST http://localhost:4000/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"senderNumber":"6281234567890","body":"saldo"}'
```

Cek `WhatsappLog` di DB untuk inbound + outbound entries.

### 8. Update dokumentasi

- `docs/reference/env-variables.md` — section provider baru.
- `docs/explanation/08-adapter-wa-provider.md` — sebutkan provider baru di overview.

## Pitfall

- **Format nomor.** Setiap gateway punya format target berbeda (`+6281...`, `6281...`, `6281...@c.us`). Lakukan normalisasi di provider.
- **Auth header.** Bearer token vs `X-Api-Key` vs query string — sesuai docs gateway.
- **Throw, bukan return.** Caller bergantung pada exception untuk distinguish success/failure. `return { ok: false }` saja tidak cukup — sendWhatsapp tidak tahu itu adalah failure.
- **Webhook dedupe.** Jika gateway tidak mengirim message id, dedup fallback ke `from:body` 30 detik. Pertimbangkan menambah message id ke gateway config.
- **Best-effort hooks.** Jika gateway punya endpoint `setSeen`, `typing`, dll, ikuti pola WAHA: panggil best-effort, jangan gagalkan pengiriman karena hook gagal.

## Saat menambah channel non-WhatsApp

Adapter pattern yang sama bisa dipakai untuk Telegram, SMS, atau Email. Tapi:
- Update nama dari `whatsappNumber` jadi sesuatu yang generic akan merembet ke schema. Lebih praktis: tambah field `channel` di `User` / `AccountIdentity` jika channel berbeda perlu disimpan.
- Webhook path baru (`/api/webhooks/telegram`).
- Lookup user mungkin perlu cara berbeda (mis. `telegramChatId`).

Lihat ADR-008 di [keputusan arsitektur](../explanation/09-keputusan-arsitektur.md) untuk konteks.

## Lanjut baca

- [Adapter provider WhatsApp](../explanation/08-adapter-wa-provider.md).
- [API: Webhooks](../reference/api/webhooks.md).
