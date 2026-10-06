# How-to: Tambah Intent WhatsApp Baru

> Kuadran: **How-to** — menambah pola perintah baru ke parser dan handler bot.

Misalnya kita ingin menambahkan intent `cek_transfer` untuk menampilkan total transfer antar akun di periode tertentu.

## Langkah

### 1. Tambah intent ke parser

Edit `backend/src/services/whatsapp/parser.js`:

#### a. Tambah verba/keyword (jika perlu)

```js
const TRANSFER_REPORT_WORDS = ['rekap transfer', 'transfer bulan', 'transfer ini', 'list transfer'];
```

#### b. Tambah deteksi di `detectIntent`

```js
function detectIntent(text) {
  const t = normalize(text);

  if (CONFIRM_WORDS.includes(t)) return 'konfirmasi';
  // ...

  // Cek transfer report (sebelum cek transfer_akun karena keyword bisa overlap)
  if (TRANSFER_REPORT_WORDS.some((w) => t.includes(w))) {
    return 'cek_transfer';
  }

  // ... existing checks
}
```

Urutan penting: cek dengan keyword lebih spesifik dulu sebelum yang lebih umum.

#### c. Tambah confidence rule

Di `heuristicParse`, tambah:

```js
if (intent === 'cek_transfer') {
  confidence = period ? 'high' : 'medium';
}
```

#### d. Tambah ke type union

Update JSDoc / dokumentasi intent di top file dan di system prompt OpenAI (`enhanceWithOpenAI`).

### 2. Tambah handler di bot service

Edit `backend/src/services/whatsapp-bot.service.js`:

```js
switch (parsed.intent) {
  // ... existing cases
  case 'cek_transfer':
    return handleCekTransfer(user, parsed);
  // ...
}

async function handleCekTransfer(user, parsed) {
  const range = getPeriodRange(parsed.entities.period);
  const transfers = await prisma.transaction.findMany({
    where: {
      tenantId: user.tenantId,
      status: 'active',
      transferGroupId: { not: null },
      transferDirection: 'out',
      transactionDate: { gte: range.from, lte: range.to },
    },
    include: { account: true },
  });

  const total = transfers.reduce((s, t) => s + Number(t.amount), 0);
  const lines = transfers
    .map((t) => `- ${t.account?.name} → ... ${formatIDR(t.amount)}`)
    .join('\n');

  const msg = `Transfer ${range.label}: ${formatIDR(total)}\n${transfers.length} kali transfer\n\n${lines || '(belum ada transfer)'}`;

  return reply(user.replyTo || user.whatsappNumber, msg, {
    tenantId: user.tenantId,
    intent: 'cek_transfer',
  });
}
```

Pola umum semua handler:
- Filter dengan `tenantId: user.tenantId`.
- Hanya transaksi `status: 'active'`.
- Pakai helper `formatIDR`, `getPeriodRange`.
- Panggil `reply(...)` dengan `intent` untuk audit di `WhatsappLog`.

### 3. Update help message

Edit `sendHelp` (`whatsapp-bot.service.js:621-661`) — tambah contoh perintah baru:

```js
const msg =
  contextLine +
  header +
  // ...
  '8. Rekap transfer:\n' +
  'rekap transfer bulan ini\n' +
  'list transfer hari ini\n\n' +
  // ...
```

### 4. Update parser test (jika ada)

Saat ini belum ada test runner. Jika menambahkan, gunakan `__test` export:

```js
import { __test } from './parser.js';

const result = __test.heuristicParse('rekap transfer bulan ini', { accounts: [], categories: [] });
console.assert(result.intent === 'cek_transfer');
console.assert(result.entities.period === 'this_month');
```

### 5. Test manual via webhook

```bash
curl -X POST http://localhost:4000/api/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"from":"6281234567890","body":"rekap transfer bulan ini"}'
```

Pesan balasan bot tercetak di console (mode mock). Cek juga `WhatsappLog` di DB.

### 6. Update dokumen reference

Tambahkan ke [`docs/reference/wa-command-grammar.md`](../reference/wa-command-grammar.md) — section intent baru + contoh.

## Pitfall yang sering terjadi

- **Keyword bentrok dengan intent lain.** `transfer` bisa cocok dengan `transfer_akun` (input transfer) DAN `cek_transfer`. Solusi: cek `cek_transfer` dulu sebelum input transfer (yang butuh nominal). Atau gunakan keyword berbeda (`rekap transfer` lebih jelas niatnya).
- **Lupa update OpenAI prompt.** Kalau heuristic miss dan AI fallback aktif, model perlu tahu intent baru. Edit `sys` prompt di `enhanceWithOpenAI`.
- **Tidak validasi `parsed.entities`.** Handler harus tahan terhadap entitas null. Beri pesan klarifikasi (`return reply(...'Periode tidak jelas')`) bukan langsung error.
- **Lupa scoping `tenantId`.** Setiap query di handler wajib filter tenant.

## Pola untuk intent yang melibatkan create transaksi

Jika intent baru membuat transaksi (mirip `input_pengeluaran`), gunakan pattern pending confirmation:

```js
await prisma.whatsappPendingTransaction.updateMany({
  where: { userId: user.id, status: 'pending' },
  data: { status: 'cancelled' },
});

await prisma.whatsappPendingTransaction.create({
  data: {
    tenantId: user.tenantId,
    userId: user.id,
    whatsappNumber: user.replyTo || user.whatsappNumber,
    rawMessage: rawText,
    parsedPayload: { kind: 'foo', ...payload }, // 'foo' kind baru
    status: 'pending',
    expiresAt: new Date(Date.now() + (Number(process.env.WA_PENDING_EXPIRES_MINUTES || 10) * 60 * 1000)),
  },
});
```

Lalu tambahkan handler `kind === 'foo'` di `handleConfirmPending` (`whatsapp-bot.service.js:334-388`).

## Lanjut baca

- [WhatsApp bot](../explanation/06-whatsapp-bot.md).
- [AI parser](../explanation/07-ai-parser.md).
- [WA command grammar](../reference/wa-command-grammar.md).
- [How-to: debug bot tanpa gateway](./debug-bot-tanpa-gateway.md).
