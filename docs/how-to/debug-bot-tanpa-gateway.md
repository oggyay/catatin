# How-to: Debug Bot WhatsApp Tanpa Gateway

> Kuadran: **How-to** — cara mensimulasikan pesan WhatsApp masuk dan inspeksi behavior bot tanpa harus menyalakan WAHA / WA-AKG.

CatatIN dirancang agar developer bisa men-test seluruh alur bot dengan provider `mock`. OTP dan balasan bot diprint ke console alih-alih dikirim ke WhatsApp asli.

## Setup

`backend/.env`:

```
WA_PROVIDER=mock
LOG_LEVEL=
```

Restart backend (`npm run dev`).

## Skenario 1: simulasi inbound

Pakai curl ke endpoint webhook:

```bash
curl -X POST http://localhost:4000/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"from":"6281234567890","body":"saldo"}'
```

Backend akan:
1. Membalas `200 OK` segera.
2. Memproses pesan via `handleIncomingMessage`.
3. Mencatat ke `WhatsappLog` (inbound + outbound).
4. Memprint balasan bot ke console (mode mock):

```
================ [MOCK WA SEND] ================
To     : 6281234567890
Message: Saldo Anda saat ini:
Total: Rp1.250.000

Kas Tunai: Rp1.250.000
================================================
```

## Skenario 2: simulasi WAHA-style payload

Kalau ingin meng-test parsing payload WAHA, pakai shape lengkap:

```bash
curl -X POST http://localhost:4000/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "event": "message",
    "session": "default",
    "payload": {
      "from": "6281234567890@c.us",
      "chatId": "6281234567890@c.us",
      "fromMe": false,
      "body": "keluar 50rb makan siang",
      "id": { "_serialized": "true_6281234567890@c.us_ABC123" }
    }
  }'
```

## Skenario 3: alur konfirmasi pending

Step 1 — kirim command yang membuat pending:

```bash
curl -X POST http://localhost:4000/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"from":"6281234567890","body":"keluar 50rb makan siang"}'
```

Console akan menampilkan pesan konfirmasi:

```
Konfirmasi pengeluaran:
Nominal: Rp50.000
Kategori: Makan
Akun: Kas Tunai
Tanggal: 26 Mei 2026
Keterangan: makan siang
Balas YA untuk simpan, atau BATAL untuk membatalkan.
```

Step 2 — balas YA:

```bash
curl -X POST http://localhost:4000/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"from":"6281234567890","body":"ya"}'
```

Console:

```
Pengeluaran berhasil disimpan.
Saldo Kas Tunai sekarang: Rp1.200.000
```

Verifikasi di DB:

```sql
SELECT id, type, amount, description, status, source FROM "Transaction"
WHERE "tenantId" = '<tenant id>'
ORDER BY "createdAt" DESC LIMIT 5;
```

## Inspeksi: tabel `WhatsappLog`

Tabel ini menyimpan **semua** pesan dwi-arah:

```sql
SELECT direction, intent, message, "createdAt"
FROM "WhatsappLog"
WHERE "whatsappNumber" = '6281234567890'
ORDER BY "createdAt" DESC LIMIT 20;
```

Kolom `meta` (JSON) menyimpan hasil parser lengkap untuk pesan inbound. Berguna saat ingin tahu "kenapa bot menjawab seperti itu":

```sql
SELECT message, intent, meta
FROM "WhatsappLog"
WHERE direction = 'inbound' AND intent IS NOT NULL
ORDER BY "createdAt" DESC LIMIT 5;
```

## Inspeksi: pending transaction

```sql
SELECT id, "rawMessage", status, "expiresAt", "parsedPayload"
FROM "WhatsappPendingTransaction"
WHERE "userId" = '<user id>'
ORDER BY "createdAt" DESC;
```

Jika user salah click YA pada pending lain, status di sini menjelaskan apa yang terjadi.

## Inspeksi: parser di-isolasi

Untuk men-test parser tanpa flow lengkap, pakai script Node.js:

```js
// scripts/test-parser.mjs
import { parseCommand, __test } from '../backend/src/services/whatsapp/parser.js';

const accounts = [{ id: 'a1', name: 'Kas Tunai', type: 'cash' }];
const categories = [{ id: 'c1', name: 'Makan', type: 'expense' }];

const cases = [
  'saldo',
  'keluar 50rb makan siang',
  'pengeluaran bulan ini',
  'transfer Bank A ke Kas 100rb',
];

for (const text of cases) {
  const result = await parseCommand(text, { accounts, categories });
  console.log(text, '→', JSON.stringify(result, null, 2));
}
```

Jalankan: `node scripts/test-parser.mjs`. Berguna saat Anda **menambah heuristic** dan ingin verifikasi cepat tanpa memanggil OpenAI.

## Skenario error umum

### Bot membalas "WhatsApp belum terhubung"

User belum punya `whatsappJid` (linked) atau nomor di payload tidak match `User.whatsappNumber` / `AccountIdentity.whatsappNumber`.

Solusi:
1. Cek nomor di DB: `SELECT id, "whatsappNumber", "whatsappJid" FROM "User" WHERE "whatsappNumber" LIKE '%34567890%';`
2. Kalau perlu link manual, pakai:

```sql
UPDATE "User" SET "whatsappJid" = '6281234567890@c.us' WHERE id = '...';
UPDATE "AccountIdentity" SET "whatsappJid" = '6281234567890@c.us' WHERE id = '...';
```

Atau lewat API lihat [link flow](../explanation/05-otentikasi-otp.md#hubungkan-whatsapp-ke-akun-link-flow).

### Bot membalas "Fitur WhatsApp tersedia mulai plan Basic"

Tenant masih plan free. Untuk test, upgrade plan via SQL atau lewat platform admin:

```sql
UPDATE "Tenant" SET "subscriptionPlan" = 'basic', "subscriptionStatus" = 'active' WHERE id = '...';
```

### Bot diam tidak respon

Cek webhook log di console backend:
- Pesan ditandai `ignored`? (group, fromMe, duplicate, empty_body) → ubah payload sesuai.
- Tidak ada log sama sekali? → Cek apakah backend listening (`http://localhost:4000/health`).
- Error stack trace? → Bug. Cek pesan exception.

### OTP tidak terbaca

Saat `WA_PROVIDER=mock`, OTP plaintext muncul di console backend:

```
================ [MOCK WA SEND] ================
To     : 6281234567890
Message: Kode OTP Anda: *123456*
Berlaku 5 menit.
...
```

Jika tidak muncul: cek `LOG_LEVEL` (jangan set `silent`) dan cek error di console.

## Tools tambahan

- **Postman / Insomnia**: lebih nyaman dari curl untuk request berulang.
- **TablePlus / DBeaver**: untuk inspeksi DB cepat.
- **`backend/scripts/debug.js`**: script utility yang sudah ada, edit untuk skenario tertentu.

## Lanjut baca

- [WhatsApp bot](../explanation/06-whatsapp-bot.md) — alur lengkap.
- [WA command grammar](../reference/wa-command-grammar.md) — pola yang valid.
- [API: Webhooks](../reference/api/webhooks.md).
