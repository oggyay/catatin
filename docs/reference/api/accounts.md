# API: Accounts

> Kuadran: **Reference** — CRUD akun + penyesuaian saldo. Source: `backend/src/routes/accounts.routes.js`.

Base path: `/api/accounts`. Semua endpoint butuh `authenticate` + `requireTenant` + `requireActiveSubscription`.

## GET `/accounts`

Semua akun di tenant aktif (termasuk yang inactive).

**Response 200**

```json
{
  "data": [
    {
      "id": "ckxxx",
      "tenantId": "ckyyy",
      "name": "Kas Tunai",
      "type": "cash",
      "openingBalance": "0",
      "currentBalance": "1250000",
      "isDefault": true,
      "status": "active",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

Order: `isDefault DESC, createdAt ASC`. Decimal sebagai string.

## POST `/accounts`

Buat akun baru.

**Request body**

```json
{
  "name": "BCA",
  "type": "bank",
  "openingBalance": 1000000,
  "isDefault": false
}
```

| Field | Tipe | Wajib | Default |
| --- | --- | --- | --- |
| `name` | string ≥ 1 | ya | - |
| `type` | `cash` / `bank` / `ewallet` | ya | - |
| `openingBalance` | number | tidak | `0` |
| `isDefault` | boolean | tidak | `false` |

**Side effects**:
- Validasi limit plan (`maxAccounts` per `getPlanLimits`). Jika sudah penuh → 403.
- Jika `isDefault=true`, akun lain di tenant di-set `isDefault=false` (transactional).
- `currentBalance` di-set sama dengan `openingBalance`.

**Response 201**

```json
{ "data": { ...account } }
```

**Error**
- 403 — limit plan terlampaui (`Plan ${plan} maksimal ${maxAccounts} akun`).

## GET `/accounts/:id`

Detail satu akun.

**Response 200** — sama format dengan list, satu objek di `data`.

**Error**
- 404 — akun tidak ditemukan / bukan milik tenant.

## PATCH `/accounts/:id`

Update field akun.

**Request body** (semua opsional)

```json
{ "name": "BCA Tabungan", "type": "bank", "isDefault": true, "status": "active" }
```

**Side effects**:
- Jika `isDefault=true`, akun lain di-set `isDefault=false` kecuali akun ini.
- `currentBalance` **tidak bisa diubah lewat endpoint ini** — gunakan `adjust-balance`.

**Response 200** — objek akun terbaru.

## DELETE `/accounts/:id`

Hapus atau soft-deactivate akun.

**Logika**:
- Jika tidak punya transaksi → hard delete.
- Jika punya transaksi → set `status='inactive'` dan kembalikan `data` + message "Akun dinonaktifkan karena sudah punya transaksi".

**Response 200**

Hard delete:

```json
{ "message": "Akun dihapus" }
```

Soft deactivate:

```json
{ "data": { ...account dengan status: "inactive" }, "message": "Akun dinonaktifkan karena sudah punya transaksi" }
```

## POST `/accounts/:id/adjust-balance`

Penyesuaian saldo manual. Membuat transaksi `type=adjustment` + `BalanceAdjustment` 1-1.

**Request body**

```json
{
  "realBalance": 1250000,
  "reason": "Hitung ulang fisik",
  "transactionDate": "2026-05-25T10:00:00Z"
}
```

| Field | Tipe | Wajib | Catatan |
| --- | --- | --- | --- |
| `realBalance` | number | ya | saldo target sebenarnya |
| `reason` | string ≥ 1 | ya | wajib, ditulis di `BalanceAdjustment.reason` dan `Transaction.description` |
| `transactionDate` | ISO date string | tidak | default `now` |

**Side effects** (atomik):
- Buat `Transaction(type='adjustment', amount=|diff|, source='adjustment')`.
- Buat `BalanceAdjustment(previousBalance, newBalance, difference)`.
- Update `Account.currentBalance = realBalance`.
- Audit log `transaction.create.adjustment`.

**Response 200**

```json
{
  "data": {
    "transaction": { ...trx tipe adjustment },
    "account": { ...account dengan currentBalance baru }
  }
}
```

**Catatan**:
- Hasil penyesuaian muncul di list `/transactions` dengan badge `adjustment` (filter `type=adjustment` atau `source=adjustment`).
- Void transaksi adjustment akan memulihkan `currentBalance` ke `previousBalance`.

## Lanjut baca

- [Domain keuangan](../../explanation/04-domain-keuangan.md) — invariant saldo.
- [API: Transactions](./transactions.md).
- [Reference: roles & permissions](../permissions-roles.md).
