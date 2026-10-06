# 8. Adapter Provider WhatsApp

> Kuadran: **Explanation** — kontrak provider yang membuat CatatIN bisa ganti gateway WhatsApp tanpa mengubah business logic.

CatatIN harus bisa berjalan di tiga konteks berbeda:

- **Development** — tanpa WhatsApp asli; OTP & balasan bot diprint ke console.
- **Self-hosted via WAHA** — gateway open-source berbasis WhatsApp Web (https://waha.devlike.pro).
- **Cloud gateway WA-AKG** — vendor pihak ketiga dengan REST API.

Untuk itu, semua kode bisnis hanya tahu satu fungsi: `sendWhatsapp(to, message)`. Provider sesungguhnya dipilih berdasarkan env `WA_PROVIDER`.

## Kontrak provider

Setiap provider mengeskpor objek dengan bentuk:

```js
export const xxxProvider = {
  name: 'mock' | 'waha' | 'wa-akg',
  async send(to, message) {
    // kirim pesan; lempar Error jika gagal
    return { ok: true, provider: <name>, data?: any };
  },
};
```

Selektor `getProvider()` di `services/whatsapp/index.js:5-17` memilih provider berdasarkan `process.env.WA_PROVIDER`:

| Nilai env | Provider modul |
| --- | --- |
| `mock` (default) | `mock.provider.js` |
| `waha` | `waha.provider.js` |
| `wa-akg` / `waakg` | `waakg.provider.js` |

Selektor di-eval setiap call (`getProvider()` dipanggil di dalam `sendWhatsapp`), sehingga **mengubah `WA_PROVIDER` di runtime** (mis. test inject) langsung berlaku tanpa restart. Saat redesign, jaga properti ini.

## `sendWhatsapp` — wrapper yang dilihat semua kode lain

```js
export async function sendWhatsapp(to, message) {
  const provider = getProvider();
  try {
    return await provider.send(to, message);
  } catch (e) {
    console.error('[WA send error]', e.message);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[WA fallback log] to=${to} msg=${message}`);
      return { ok: false, error: e.message, fallback: true };
    }
    throw e;
  }
}
```

Behavior penting:

- **Di production** error provider di-rethrow → caller perlu menangani (mis. OTP service akan menggagalkan request).
- **Di development** error tidak menghentikan flow; pesan di-log ke console agar developer tetap bisa lanjut testing.
- Tidak ada retry built-in. Jika provider memerlukan retry, lakukan di provider itu sendiri.

## Mock provider — default development

`mock.provider.js`:

```js
export const mockProvider = {
  name: 'mock',
  async send(to, message) {
    console.log('\n================ [MOCK WA SEND] ================');
    console.log('To     :', to);
    console.log('Message:', message);
    console.log('================================================\n');
    return { ok: true, provider: 'mock' };
  },
};
```

Kegunaan:
- Saat register/login, OTP plaintext muncul di console backend → developer copy ke form.
- Saat bot membalas, isi balasan terlihat di console.
- Tidak butuh internet, tidak butuh akun WhatsApp.

Default `WA_PROVIDER=mock` di `.env.example` dan `docker-compose.yml`.

## WAHA provider — self-hosted

WAHA adalah container Docker yang menjalankan WhatsApp Web headless dan menyediakan REST API. Provider CatatIN-nya di `waha.provider.js`:

### Endpoint yang dipanggil
- `POST {WAHA_BASE_URL}/api/sendSeen` (best-effort, mark chat sebagai seen).
- `POST {WAHA_BASE_URL}/api/startTyping` (best-effort, indikator typing).
- Delay `WAHA_TYPING_DELAY_MS` (default 700ms, max 3 detik).
- `POST {WAHA_BASE_URL}/api/sendText` (yang sebenarnya mengirim).
- `POST {WAHA_BASE_URL}/api/stopTyping`.

### Authentication
Header `X-Api-Key: ${WAHA_API_KEY}` jika API key dikonfigurasi.

### chatId format
Jika `to` sudah berisi `@` (mis. `6281234567890@c.us`), dipakai apa adanya. Jika hanya nomor, dilengkapi `@c.us`.

### Toggling typing/seen
- `WAHA_SEND_SEEN=false` mematikan call `sendSeen`.
- `WAHA_TYPING_ENABLED=false` mematikan typing indicator dan delay.
- `WAHA_TYPING_DELAY_MS=0` set delay nol.

Best-effort wrapper (`bestEffort`) memastikan kegagalan `sendSeen`/`typing` tidak menggagalkan pengiriman pesan utama. Hanya `sendText` yang error-nya di-rethrow.

### Webhook arah balik
Konfigurasi webhook WAHA harus mengarah ke `POST {APP_BASE_URL}/api/webhooks/whatsapp`. Format payload yang diharapkan ada di `routes/webhooks.routes.js:32-61` (parser membaca shape `{ payload: { from, body, ... } }` dengan banyak field opsional).

## WA-AKG provider — generic gateway

WA-AKG adalah cloud gateway dengan API minimal. Provider di `waakg.provider.js`:

```js
POST {WA_AKG_BASE_URL}/send
Headers: Authorization: Bearer ${WA_AKG_API_KEY}
Body: { number, message, device? }
```

`device` field bersifat opsional (jika gateway support multi-device). Webhook inbound diharapkan mengirim payload `{ sender|from, message|text }` (lihat `webhooks.routes.js:63-69`).

WA-AKG adalah **adapter generik**—jika gateway lain memiliki endpoint mirip, sering kali cukup tunjuk `WA_AKG_BASE_URL` ke endpoint tersebut.

## Webhook inbound: dukungan banyak shape payload

Bot perlu menerima pesan masuk dari banyak gateway dengan payload berbeda. `extractPayload` (`webhooks.routes.js:28-70`) mengenali setidaknya tiga bentuk:

```js
// WAHA-style
{ event, session, payload: { from, body, chatId, fromMe, ... } }

// AKG / generic
{ sender, message }
{ from, body }
{ number, message }
{ phone, body }

// Meta verification (GET request)
?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
```

Logika ekstraksi melakukan:
- Resolusi `from` dengan kandidat `chatId`, `from`, `to`, `author`, `sender.id`, `id.remote`, dll.
- Deteksi group chat lewat `@g.us` → diabaikan (`webhooks.routes.js:93-95`).
- Deteksi pesan dari diri sendiri (`fromMe`) → diabaikan agar tidak loop.
- Dedup `messageId` dalam jendela 30 detik.
- Verifikasi token Meta saat mode webhook verification (untuk integrasi WhatsApp Cloud API kalau dipakai nanti).

## Kapan menambah provider baru

Tambah provider baru diperlukan jika:

- Vendor baru (mis. Twilio, Wablas, Fonnte) dengan API berbeda.
- Channel non-WA yang ingin dipasang (Telegram, SMS) — meski ini menyalahi nama "WhatsApp", pola adapter yang sama bisa dipakai.

Pola implementasinya cukup sederhana — lihat [How-to: tambah provider WhatsApp](../how-to/tambah-provider-whatsapp.md). Yang harus dijaga:

1. **Kontrak `send(to, message)`** — sinkron tipe input dengan provider lain.
2. **Lempar Error pada kegagalan**; jangan return success palsu.
3. **Tambah ke selektor** `services/whatsapp/index.js`.
4. **Update `webhooks.routes.js extractPayload`** jika format inbound berbeda.

## Hal-hal yang sengaja **tidak** ada di adapter saat ini

- **Tidak ada queue.** Setiap call adalah HTTP langsung. Untuk volume besar, sisipkan BullMQ / Redis-backed queue di antara `sendWhatsapp` dan provider.
- **Tidak ada rate-limit per provider.** WAHA & AKG mungkin punya batas internal; saat ini caller tidak tahu.
- **Tidak ada delivery callback.** Status delivered/read dari provider tidak dipropagate balik. Jika dibutuhkan untuk reminder, perlu webhook tambahan + `WhatsappLog` enrichment.
- **Tidak ada media support.** Hanya text. Dukungan kirim image / dokumen perlu menambahkan method baru di kontrak provider.

## Lanjut baca

- [WhatsApp bot](./06-whatsapp-bot.md) — sisi business logic yang memakai adapter.
- [Reference: env variables — WA provider](../reference/env-variables.md#whatsapp-provider).
- [How-to: tambah provider WhatsApp](../how-to/tambah-provider-whatsapp.md).
- [API webhooks](../reference/api/webhooks.md).
