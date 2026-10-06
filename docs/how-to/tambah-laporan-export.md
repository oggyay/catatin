# How-to: Tambah Laporan & Export Excel

> Kuadran: **How-to** — pola membuat laporan agregat baru + export Excel multi-sheet menggunakan ExcelJS.

Sasaran: laporan top-N user paling aktif (jumlah transaksi) dalam periode tertentu, plus export Excel.

## Komponen yang terlibat

- `backend/src/routes/reports.routes.js` — semua endpoint laporan.
- `exceljs` — library Excel writer.
- Helper: `dayjs` untuk format tanggal, `resolveRange` untuk parsing periode.

## Langkah

### 1. Tambah endpoint JSON

Edit `backend/src/routes/reports.routes.js`:

```js
import dayjs from 'dayjs';
import { Router } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/error.js';
import { authenticate, requireTenant, requireActiveSubscription } from '../middleware/auth.js';

// ... router yang sudah ada ...

// helper resolveRange existing — reuse

async function buildTopUsers(tenantId, range) {
  const trxs = await prisma.transaction.groupBy({
    by: ['userId'],
    where: {
      tenantId,
      status: 'active',
      transactionDate: { gte: range.from, lte: range.to },
      transferGroupId: null,
    },
    _count: true,
    _sum: { amount: true },
  });

  const users = await prisma.user.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, name: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  return trxs
    .map((t) => ({
      userId: t.userId,
      name: userMap[t.userId] || 'Unknown',
      transactionCount: t._count,
      totalAmount: Number(t._sum.amount || 0),
    }))
    .sort((a, b) => b.transactionCount - a.transactionCount)
    .slice(0, 10);
}

router.get(
  '/top-users',
  asyncHandler(async (req, res) => {
    const range = resolveRange(req.query);
    const data = await buildTopUsers(req.tenantId, range);
    res.json({ data: { range, items: data } });
  })
);
```

### 2. Tambah endpoint export Excel

Pola umum (ikuti `cashflow/export` di file yang sama):

```js
router.get(
  '/top-users/export',
  asyncHandler(async (req, res) => {
    const range = resolveRange(req.query);
    const items = await buildTopUsers(req.tenantId, range);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'CatatIN';
    wb.created = new Date();

    const summary = wb.addWorksheet('Ringkasan');
    summary.columns = [
      { header: 'Keterangan', key: 'k', width: 30 },
      { header: 'Nilai', key: 'v', width: 30 },
    ];
    summary.addRows([
      { k: 'Periode', v: range.label },
      { k: 'Jumlah user di laporan', v: items.length },
    ]);

    const detail = wb.addWorksheet('Top Users');
    detail.columns = [
      { header: 'Nama', key: 'name', width: 28 },
      { header: 'Jumlah Transaksi', key: 'transactionCount', width: 18 },
      { header: 'Total Amount', key: 'totalAmount', width: 22 },
    ];
    detail.addRows(items);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="top-users-${dayjs().format('YYYYMMDD-HHmmss')}.xlsx"`
    );
    await wb.xlsx.write(res);
    res.end();
  })
);
```

### 3. Konsumsi di frontend

Buat halaman atau tab baru. Untuk menampilkan tabel:

```jsx
const [data, setData] = useState(null);
useEffect(() => {
  api.get('/reports/top-users', { params: { period: 'this_month' } })
    .then(({ data }) => setData(data.data));
}, []);
```

Untuk download Excel, ikuti pola di `frontend/src/pages/CashflowReport.jsx`:

```jsx
import { getToken } from '../lib/api.js';

const exportXlsx = async () => {
  const params = new URLSearchParams();
  params.set('period', 'this_month');
  const url = `/api/reports/top-users/export?${params.toString()}`;
  const token = getToken();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) { alert('Gagal export'); return; }
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `top-users-${Date.now()}.xlsx`;
  a.click();
};
```

Pakai `fetch` (bukan axios) karena response-nya binary blob; axios juga bisa dengan `responseType: 'blob'`, tapi pola repo ini sudah konsisten pakai `fetch` untuk download.

### 4. Test

```bash
TOKEN=...

curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:4000/api/reports/top-users?period=this_month"

curl -H "Authorization: Bearer $TOKEN" \
  -o top-users.xlsx \
  "http://localhost:4000/api/reports/top-users/export?period=this_month"
open top-users.xlsx
```

## Pola yang berguna

### Aggregate dengan Prisma

```js
// Sum + count per group
prisma.transaction.groupBy({
  by: ['categoryId', 'type'],
  where,
  _sum: { amount: true },
  _count: true,
});

// Total tanpa group
prisma.transaction.aggregate({
  where,
  _sum: { amount: true },
  _avg: { amount: true },
  _count: true,
});
```

### Konversi Decimal Prisma ke number

Decimal di Prisma di-serialize sebagai string. Selalu `Number(value || 0)`:

```js
const total = Number(agg._sum.amount || 0);
```

### Periode parsing

`resolveRange(req.query)` di `reports.routes.js:11-30` menangani:
- `?period=today|this_week|this_month`
- `?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD`

Kalau butuh periode custom (mis. quarter), tambah case di `resolveRange`.

### Exclude transfer

Filter `transferGroupId: null` agar transfer antar akun tidak menggandakan flow.

### Styling Excel

Tambah formatting per cell:

```js
detail.getRow(1).font = { bold: true };
detail.getColumn('totalAmount').numFmt = '#,##0';
```

## Pitfall

- **Forget tenant scoping.** Setiap query agregat wajib `tenantId: req.tenantId`.
- **Menyertakan transaksi void / transfer.** Default behavior: filter `status: 'active'` & `transferGroupId: null` kecuali memang ingin sebaliknya.
- **Memory issue saat data besar.** ExcelJS load semua row ke memory. Untuk dataset besar, pakai stream writer (`wb.xlsx.write(res)` sudah stream-friendly).

## Lanjut baca

- [API: Reports](../reference/api/reports.md) — endpoint cashflow existing.
- [Domain keuangan](../explanation/04-domain-keuangan.md) — apa yang dianggap "transaksi aktif".
- [How-to: tambah endpoint API](./tambah-endpoint-api.md).
