# API: Reports

> Kuadran: **Reference** — laporan cashflow JSON dan export Excel. Source: `backend/src/routes/reports.routes.js`.

Base path: `/api/reports`. Butuh `authenticate` + `requireTenant` + `requireActiveSubscription`.

## Periode

Semua endpoint reports menerima cara pilih periode yang sama:

| Param | Pilihan | Catatan |
| --- | --- | --- |
| `period` | `today` / `this_week` / `this_month` (default) | dipakai jika `dateFrom`/`dateTo` kosong |
| `dateFrom` | ISO date string | dipakai bersama `dateTo` |
| `dateTo` | ISO date string | inclusive |

Logika ada di `resolveRange` (`reports.routes.js:11-30`). Jika kedua range custom diisi, `period` diabaikan.

## GET `/reports/cashflow`

Ringkasan + breakdown kategori & akun untuk periode terpilih.

**Response 200**

```json
{
  "data": {
    "range": {
      "from": "2026-05-01T00:00:00.000Z",
      "to": "2026-05-31T23:59:59.999Z",
      "label": "Bulan ini"
    },
    "totalIncome": 5000000,
    "totalExpense": 3200000,
    "netCashflow": 1800000,
    "incomeCount": 12,
    "expenseCount": 47,
    "incomeByCategory": [
      { "categoryId": "ck1", "name": "Penjualan", "total": 4000000, "count": 8 },
      { "categoryId": "ck2", "name": "Bonus", "total": 1000000, "count": 4 }
    ],
    "expenseByCategory": [
      { "categoryId": "ck3", "name": "Makan", "total": 1200000, "count": 22 },
      { "categoryId": "ck4", "name": "Transportasi", "total": 800000, "count": 15 }
    ],
    "perAccount": [
      {
        "accountId": "cka",
        "name": "Kas Tunai",
        "type": "cash",
        "currentBalance": 1250000,
        "income": 1500000,
        "expense": 700000,
        "net": 800000
      }
    ]
  }
}
```

**Catatan**:
- Hanya transaksi `status='active'` & `type IN [income, expense]` & `transferGroupId IS NULL` yang dihitung. Transfer tidak menggandakan flow.
- Kategori tanpa nama (kategori dihapus) muncul sebagai "Lainnya".
- `perAccount.currentBalance` = saldo saat ini (snapshot), bukan saldo periode.
- Sort `byCategory` desc by `total`.

## GET `/reports/cashflow/export`

Export Excel multi-sheet.

**Response**: file XLSX (`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`), filename `cashflow-{YYYYMMDD-HHmmss}.xlsx`.

Sheet yang dihasilkan:

| Sheet | Isi |
| --- | --- |
| `Ringkasan` | Periode + total income/expense/net + count |
| `Pemasukan per Kategori` | Nama, count, total |
| `Pengeluaran per Kategori` | Nama, count, total |
| `Per Akun` | Nama, tipe, income, expense, net, currentBalance |
| `Transaksi` | Tanggal, tipe, akun, kategori, nominal, keterangan, sumber, user, status |

Sheet `Transaksi` mencakup semua transaksi `status=active` dalam range, kecuali sisi transfer (`transferGroupId IS NULL`). Order: `transactionDate ASC`.

## Catatan implementasi

- Library: `exceljs` (versi 4.4+).
- Decimal Prisma di-Number()-kan saat masuk Excel.
- Workbook `creator` di-set "CatatIN".
- Tidak ada styling header (cell header dasar dari ExcelJS). Saat redesign, tambahkan styling melalui `worksheet.getRow(1).font = { bold: true }`.

## Lanjut baca

- [Domain keuangan](../../explanation/04-domain-keuangan.md).
- [How-to: tambah laporan & export](../../how-to/tambah-laporan-export.md).
