# API: Dashboard

> Kuadran: **Reference** — endpoint summary dashboard. Source: `backend/src/routes/dashboard.routes.js`.

Base path: `/api/dashboard`. Semua endpoint membutuhkan `authenticate` + `requireTenant` + `requireActiveSubscription`.

## GET `/dashboard/summary`

Ringkasan KPI bulan berjalan untuk tenant aktif.

**Query parameters**: tidak ada.

**Response 200**

```json
{
  "data": {
    "totalBalance": 1250000,
    "incomeThisMonth": 3500000,
    "expenseThisMonth": 2250000,
    "netCashflow": 1250000,
    "accountsCount": 3,
    "period": {
      "from": "2026-05-01T00:00:00.000Z",
      "to": "2026-05-31T23:59:59.999Z",
      "label": "bulan ini"
    }
  }
}
```

| Field | Tipe | Asal |
| --- | --- | --- |
| `totalBalance` | number | jumlah `currentBalance` semua akun **active** |
| `incomeThisMonth` | number | sum `Transaction.amount` `type=income, status=active`, transferGroupId null, dalam bulan ini |
| `expenseThisMonth` | number | sum yang sama untuk `type=expense` |
| `netCashflow` | number | income − expense |
| `accountsCount` | number | jumlah akun aktif |
| `period.from/to` | ISO datetime | start/end bulan server timezone |
| `period.label` | string | selalu `"bulan ini"` |

**Catatan implementasi**:
- Transaksi transfer (yang punya `transferGroupId`) **tidak diikutkan** ke income/expense supaya tidak menggandakan flow.
- Transaksi `adjustment` juga di-exclude (filter `type IN [income, expense]`).
- Saldo akun inactive **tidak masuk** total balance.

## GET `/dashboard/recent-transactions`

Daftar transaksi terbaru (untuk widget "Transaksi Terbaru").

**Query parameters**

| Param | Default | Maks | Catatan |
| --- | --- | --- | --- |
| `limit` | `10` | `50` | clamp di `Math.min(limit, 50)` |

**Response 200**

```json
{
  "data": [
    {
      "id": "ckxxx",
      "type": "expense",
      "amount": "50000",
      "transactionDate": "2026-05-25T00:00:00.000Z",
      "description": "makan siang",
      "source": "whatsapp",
      "status": "active",
      "transferGroupId": null,
      "transferDirection": null,
      "attachmentUrl": null,
      "createdAt": "...",
      "updatedAt": "...",
      "tenantId": "...",
      "userId": "...",
      "accountId": "...",
      "categoryId": "...",
      "account": { "id": "...", "name": "Kas Tunai" },
      "category": { "id": "...", "name": "Makan", "type": "expense" }
    }
  ]
}
```

Urut by `transactionDate DESC, createdAt DESC`. Hanya transaksi `status: active` yang dimasukkan.

**Catatan**:
- Decimal Prisma di-serialize sebagai string. Frontend membungkus dengan `Number(...)` di `formatIDR`.
- Tidak menyertakan informasi user (untuk widget kompak); jika butuh, gunakan endpoint `/transactions` dengan filter.
- Transaksi transfer tetap muncul, frontend bisa memutuskan menampilkannya sebagai pasangan atau tidak.

## Lanjut baca

- [API: Transactions](./transactions.md) untuk listing dengan filter penuh.
- [API: Reports](./reports.md) untuk cashflow per periode dengan breakdown.
- [Domain keuangan](../../explanation/04-domain-keuangan.md) — invariant saldo.
