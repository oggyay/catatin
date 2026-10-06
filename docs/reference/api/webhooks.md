# API: Webhooks

> Kuadran: **Reference** — endpoint webhook untuk gateway WhatsApp. Source: `backend/src/routes/webhooks.routes.js`.

Base path: `/api/webhooks`. Rate limit: 120 request / menit per IP (`server.js:54-59`).

## POST `/webhooks/whatsapp`

Endpoint inbound untuk semua provider WhatsApp.

### Bentuk payload yang didukung

`extractPayload` mengenali tiga shape:

#### WAHA-style

```json
{
  "event": "message",
  "session": "default",
  "payload": {
    "from": "6281234567890@c.us",
    "chatId": "6281234567890@c.us",
    "to": "6281111111111@c.us",
    "author": null,
    "fromMe": false,
    "body": "saldo",
    "id": { "fromMe": false, "_serialized": "..." }
  }
}
```

Detail lain yang dikenali: `payload.text`, `payload.caption`, `payload.sender.id`, `payload.id.remote`, `payload._data.author`, `payload._data.id._serialized`.

#### Generic / WA-AKG

```json
{ "from": "6281234567890", "body": "saldo" }
```

Variasi key yang juga dikenali: `sender`, `number`, `phone`, `msisdn`, `waNumber`, `message`, `text`, `content`, `msg`. Plus `fromMe`, `id`/`messageId`.

### Rules dan filter

1. **Group chat** (`from` mengandung `@g.us`) → diabaikan, balas `{ "ok": true, "ignored": "group" }`.
2. **Pesan dari diri sendiri** (`fromMe = true`) → diabaikan untuk mencegah loop, balas `{ "ok": true, "ignored": "from_me" }`.
3. **Body kosong** → diabaikan.
4. **Tidak ada `from`** → diabaikan.
5. **Duplikat** (sama `messageId` atau `from:body` dalam 30 detik) → diabaikan, balas `{ "ok": true, "ignored": "duplicate" }`.
6. Pesan valid → balas `{ "ok": true }` segera, lalu proses async via `handleIncomingMessage` (fire-and-forget).

### Response

Semua kasus di atas mengembalikan `200 OK` dengan body JSON kecil. Backend **tidak** mengandalkan body response untuk gateway; flag `ignored` hanya untuk debugging webhook.

### Catatan implementasi

- Dedup memakai `Map` in-memory di proses Express. Tidak konsisten antar pod.
- Async fire-and-forget: jika `handleIncomingMessage` throw, error di-log ke console (`webhooks.routes.js:117`) tapi tidak balik ke gateway.
- `normalizeWhatsappNumber` dipakai untuk format konsisten.
- Saat `LOG_LEVEL` bukan `error`/`silent`, setiap inbound di-log struktural ke console.

## GET `/webhooks/whatsapp`

Verifikasi webhook gaya Meta Cloud API.

**Query parameters**

| Param | Catatan |
| --- | --- |
| `hub.mode` | `subscribe` |
| `hub.verify_token` | harus sama dengan ENV `WA_WEBHOOK_VERIFY_TOKEN` |
| `hub.challenge` | string yang harus di-echo |

**Response 200**:
- Jika token cocok → respond plain text `hub.challenge`.
- Jika tidak cocok → respond JSON `{ "ok": true }` (tetap 200 supaya tidak memberi info ke probe).

> Saat ini integrasi utama adalah WAHA & WA-AKG yang **tidak** memakai mekanisme verifikasi ini. Endpoint disiapkan untuk migrasi ke WhatsApp Cloud API resmi di masa depan.

## Tips troubleshooting

- **Pesan masuk tapi bot tidak respon**: cek `WhatsappLog` (`SELECT * FROM "WhatsappLog" ORDER BY "createdAt" DESC LIMIT 20`). Jika `direction='inbound'` ada tapi `outbound` tidak ada, periksa pesan kesalahan di console.
- **Bot tidak menemukan user**: cek `AccountIdentity.whatsappJid` vs JID yang masuk. Beberapa device WAHA mengirim format `@lid` yang berbeda dari `@c.us`.
- **Pesan didedup salah**: dedup window 30 detik berdasarkan `messageId`. Jika gateway tidak mengirim id, fallback ke `from:body`.

## Lanjut baca

- [WhatsApp bot](../../explanation/06-whatsapp-bot.md) — alur lengkap setelah webhook.
- [Adapter WhatsApp](../../explanation/08-adapter-wa-provider.md) — sisi outbound.
- [How-to: debug bot tanpa gateway](../../how-to/debug-bot-tanpa-gateway.md).
