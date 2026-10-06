# API: Transactions

> Kuadran: **Reference** — CRUD transaksi, transfer, void. Source: `backend/src/routes/transactions.routes.js` + `services/transaction.service.js`.

Base path: `/api/transactions`. Semua endpoint butuh `authenticate` + `requireTenant` + `requireActiveSubscription`.

## GET `/transactions`

List dengan filter & pagination.

**Query parameters**

| Param | Tipe | Default | Catatan |
| --- | --- | --- | --- |
| `page` | int ≥ 1 | `1` | |
| `pageSize` | int 1–200 | `20` | |
| `type` | `income`/`expense`/`adjustment` | - | |
| `accountId` | string | - | filter akun. **Termasuk pasangan transfer** akun ini |
| `categoryId` | string | - | |
| `userId` | string | - | |
| `source` | `web`/`whatsapp`/`adjustment` | - | |
| `status` | `active`/`void` | - | default tidak filter (semua) |
| `dateFrom` | ISO date string | - | inclusive |
| `dateTo` | ISO date string | - | inclusive |
| `q` | string | - | substring (case-insensitive) ke `description` |

**Catatan filter `accountId`**: backend juga mencari `transferGroupId` yang mengandung akun tersebut sehingga **kedua sisi** transfer terlihat saat user filter satu akun.

**Response 200**

```json
{
  "data": [
    {
      "id": "ckxxx",
      "tenantId": "...",
      "userId": "...",
      "accountId": "...",
      "categoryId": "...",
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
      "account": { "id": "...", "name": "Kas Tunai", "type": "cash" },
      "category": { "id": "...", "name": "Makan", "type": "expense" },
      "user": { "id": "...", "name": "Joni" }
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "total": 73, "totalPages": 4 }
}
```

Order: `transactionDate DESC, createdAt DESC`.

## POST `/transactions`

Buat transaksi income / expense baru.

**Request body**

```json
{
  "type": "expense",
  "amount": 50000,
  "accountId": "ckaaa",
  "categoryId": "ckccc",
  "transactionDate": "2026-05-25T00:00:00Z",
  "description": "makan siang"
}
```

| Field | Tipe | Wajib | Catatan |
| --- | --- | --- | --- |
| `type` | `income`/`expense` | ya | tipe `adjustment` dibuat lewat `accounts/:id/adjust-balance` |
| `amount` | number > 0 | ya | |
| `accountId` | string | ya | akun harus aktif |
| `categoryId` | string | tidak | jika diisi, harus punya `type` yang sama dengan transaksi |
| `transactionDate` | ISO date string | tidak (default now) | |
| `description` | string | tidak | |

**Side effects** (atomik via `prisma.$transaction`):
- Insert `Transaction` (`source='web'`, `status='active'`).
- Update `Account.currentBalance` (income → +, expense → −).
- Tulis audit `transaction.create.{type}`.

**Response 201**

```json
{
  "data": {
    "transaction": { ...trx },
    "account": { ...account dengan currentBalance baru }
  }
}
```

**Error**
- 400 — amount ≤ 0 / akun tidak aktif / kategori salah tipe.
- 404 — akun atau kategori tidak ditemukan.

## POST `/transactions/transfer`

Buat pasangan transfer antar akun.

**Request body**

```json
{
  "fromAccountId": "ckA",
  "toAccountId": "ckB",
  "amount": 100000,
  "transactionDate": "2026-05-25T00:00:00Z",
  "description": "tarik tunai"
}
```

| Field | Wajib | Catatan |
| --- | --- | --- |
| `fromAccountId` / `toAccountId` | ya | tidak boleh sama |
| `amount` | ya | > 0 |
| `transactionDate` | tidak | |
| `description` | tidak | default `Transfer ${from} -> ${to}` |

**Validasi**:
- Akun asal & tujuan harus aktif.
- Saldo akun asal harus ≥ amount (`createTransferAtomic`, `transaction.service.js:153`).

**Side effects** (atomik):
- Generate `transferGroupId` (UUID).
- Buat `Transaction` `expense` di `from` dengan `transferDirection='out'`.
- Buat `Transaction` `income` di `to` dengan `transferDirection='in'`.
- Update saldo kedua akun.
- Audit `transaction.transfer`.

**Response 201**

```json
{
  "data": {
    "out": { ...trx out },
    "incoming": { ...trx in },
    "from": { ...akun asal updated },
    "to": { ...akun tujuan updated },
    "transferGroupId": "uuid"
  }
}
```

**Error**
- 400 — akun sama / saldo tidak cukup / amount ≤ 0.

## GET `/transactions/:id`

Detail transaksi.

**Response 200**

```json
{
  "data": {
    ...transaction,
    "account": { ... },
    "category": { ... },
    "user": { "id": "...", "name": "..." },
    "adjustment": { ...BalanceAdjustment } // hanya jika type='adjustment'
  }
}
```

## PATCH `/transactions/:id`

Edit transaksi (income/expense saja). Transfer & adjustment tidak bisa di-edit.

**Request body** (semua opsional)

```json
{
  "amount": 60000,
  "accountId": "ckBBB",
  "categoryId": "ckCCC",
  "transactionDate": "2026-05-25T00:00:00Z"
}
```

**Logika** (`updateTransactionAtomic`, `transaction.service.js:289-393`):
- Jika `accountId` berubah, saldo lama di-rollback dan saldo baru ditambah.
- Jika hanya `amount` berubah, saldo akun di-koreksi delta.
- Validasi kategori tetap sesuai tipe transaksi.
- Audit `transaction.update`.

**Response 200** — transaksi setelah update.

**Error**
- 400 — transaksi sudah void / type adjustment / amount ≤ 0 / kategori tidak sesuai tipe / akun tidak aktif.
- 404 — transaksi / akun / kategori tidak ditemukan.

## POST `/transactions/:id/void`

Batalkan transaksi (soft delete dengan kompensasi saldo).

**Logika**:
- Untuk income → kurangi saldo.
- Untuk expense → tambah saldo.
- Untuk adjustment → set saldo ke `BalanceAdjustment.previousBalance`.
- Untuk transfer → void kedua sisi & rollback dua saldo.
- Set `status='void'`.
- Audit `transaction.void` atau `transaction.transfer.void`.

**Response 200**

```json
{ "data": { ...transaction dengan status: "void" } }
```

**Error**
- 400 — transaksi sudah void.
- 404 — transaksi tidak ditemukan.

## Catatan tentang upload attachment

README menyebut `POST /transactions` menerima `multipart/form-data` dengan field `attachment`. Saat ini route handler **belum menerima multipart langsung** — body diparse sebagai JSON via `express.json()`. Field `attachmentUrl` di-set null saat insert. Implementasi multer dapat ditambahkan ulang saat fitur upload diaktifkan kembali; lihat [Roadmap](../../roadmap.md).

## Lanjut baca

- [Domain keuangan](../../explanation/04-domain-keuangan.md) — invariant.
- [API: Reports](./reports.md) — agregasi cashflow.
- [How-to: tambah laporan](../../how-to/tambah-laporan-export.md).
