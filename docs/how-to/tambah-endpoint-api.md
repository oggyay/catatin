# How-to: Tambah Endpoint API Baru

> Kuadran: **How-to** — resep singkat untuk menambah endpoint REST baru dengan pola yang konsisten.

Sasaran: menambah endpoint di domain yang sudah ada (mis. tambah `GET /api/transactions/stats`) atau membuat domain baru.

## Resep cepat

### 1. Tentukan path & guard

| Pertanyaan | Jawaban tipikal |
| --- | --- |
| Public atau perlu login? | Login (default). |
| Butuh tenant aktif? | Ya untuk endpoint user; tidak untuk webhook/admin. |
| Butuh subscription aktif? | Ya untuk endpoint bisnis (transaksi, akun, laporan). |
| Butuh role tertentu? | Owner/admin only? Tambah cek manual. |

Pakai kombinasi middleware:

```js
import { authenticate, requireTenant, requireActiveSubscription, requirePlatformAdmin } from '../middleware/auth.js';

router.use(authenticate, requireTenant, requireActiveSubscription);
```

### 2. Validasi body / query dengan zod

Selalu pakai `zod` (sudah dependency). Pola:

```js
import { z } from 'zod';

const querySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
});

const bodySchema = z.object({
  name: z.string().min(1),
  amount: z.coerce.number().positive(),
});
```

Note `z.coerce.number()` untuk konversi string → number (input form/JSON kadang string).

### 3. Tulis handler dengan `asyncHandler` & `HttpError`

```js
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { asyncHandler, HttpError } from '../utils/error.js';
import { authenticate, requireTenant, requireActiveSubscription } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, requireTenant, requireActiveSubscription);

const querySchema = z.object({ from: z.string().optional(), to: z.string().optional() });

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const { from, to } = querySchema.parse(req.query);

    // SCOPE TENANT — wajib
    const where = {
      tenantId: req.tenantId,
      status: 'active',
      ...(from || to
        ? { transactionDate: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
    };

    const [count, totalAmount] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.aggregate({ where, _sum: { amount: true } }),
    ]);

    res.json({
      data: {
        count,
        totalAmount: Number(totalAmount._sum.amount || 0),
      },
    });
  })
);

export default router;
```

Aturan ketat:
- **Filter `tenantId: req.tenantId`** di setiap query bisnis. Tanpa ini, tenant lain bisa terbaca.
- **Lempar `HttpError(status, msg)`** untuk error yang user-facing.
- **`asyncHandler(fn)`** memastikan promise rejected lewat ke `errorHandler`.

### 4. Operasi yang menyentuh saldo → pakai service

Jangan tulis ke `Transaction` atau `Account.currentBalance` langsung. Panggil service:

```js
import { createTransactionAtomic, voidTransactionAtomic } from '../services/transaction.service.js';

router.post('/foo', asyncHandler(async (req, res) => {
  const { transaction, account } = await createTransactionAtomic({
    tenantId: req.tenantId,
    userId: req.user.id,
    accountId: payload.accountId,
    type: payload.type,
    amount: payload.amount,
    categoryId: payload.categoryId || null,
    transactionDate: payload.transactionDate,
    description: payload.description,
    source: 'web',
  });
  res.status(201).json({ data: { transaction, account } });
}));
```

Service membungkus `prisma.$transaction`, validasi tipe, update saldo, dan menulis audit log.

### 5. Audit log untuk perubahan signifikan

Untuk operasi non-trivial (perubahan role, user, tenant, dll.) tulis `AuditLog`:

```js
await prisma.auditLog.create({
  data: {
    tenantId: req.tenantId,
    userId: req.user.id,
    action: 'foo.update',
    entityType: 'foo',
    entityId: foo.id,
    oldValue: { ...prev },
    newValue: { ...next },
  },
});
```

Konvensi nama action: `domain.operation` atau `domain.operation.subop`. Lihat [Database schema → AuditLog](../reference/database-schema.md#auditlog) untuk daftar action existing.

### 6. Mount route di `server.js`

Jika domain baru:

```js
// backend/src/server.js
import statsRoutes from './routes/stats.routes.js';
// ...
app.use('/api/stats', statsRoutes);
```

Untuk endpoint di domain existing, edit `routes/<domain>.routes.js` saja.

### 7. Testing manual via curl

```bash
# Login dulu untuk dapat token (mode mock)
curl -X POST http://localhost:4000/api/auth/request-otp \
  -H "Content-Type: application/json" \
  -d '{"whatsappNumber":"6281234567890","purpose":"login"}'

# Lihat OTP di console backend, lalu:
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"whatsappNumber":"6281234567890","code":"123456"}' | jq -r .token)

curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/stats
```

### 8. Update dokumen reference

Tambahkan dokumen di `docs/reference/api/<domain>.md`:
- Method + path.
- Auth (guard yang dipakai).
- Request body / query parameters.
- Response 200 dengan contoh JSON.
- Error code yang mungkin muncul.

## Checklist akhir

- [ ] Path mengikuti konvensi `/api/<domain>/<resource>` (kebab-case).
- [ ] Schema zod menutup semua input yang dipakai.
- [ ] Filter `tenantId: req.tenantId` ada di setiap query bisnis.
- [ ] Operasi saldo lewat service, tidak langsung Prisma.
- [ ] Audit log untuk perubahan signifikan.
- [ ] Error pakai `HttpError(status, msg)` dengan pesan user-facing Indonesia.
- [ ] Mount di `server.js` jika domain baru.
- [ ] Dokumen reference di-update.
- [ ] Test manual dengan curl atau lewat frontend.

## Common pitfalls

- **Lupa filter tenantId** → data leak antar tenant. Code review wajib check ini.
- **Pakai `prisma.transaction.create({...})` langsung** untuk operasi yang ubah saldo → saldo akan drift.
- **Update role tanpa update `TenantMember`** → mismatch state. Lihat pola `settings.routes.js:505-526`.
- **Lupa `asyncHandler`** → promise rejection unhandled.

## Lanjut baca

- [Domain keuangan](../explanation/04-domain-keuangan.md) — invariant saldo.
- [Multi-tenant](../explanation/03-model-multitenant.md) — scoping rules.
- [Permissions & roles](../reference/permissions-roles.md).
- [Error codes](../reference/error-codes.md).
