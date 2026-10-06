# API: Categories

> Kuadran: **Reference** — CRUD kategori income/expense. Source: `backend/src/routes/categories.routes.js`.

Base path: `/api/categories`. Semua endpoint butuh `authenticate` + `requireTenant` + `requireActiveSubscription`.

## GET `/categories`

Semua kategori di tenant aktif.

**Query parameters**

| Param | Pilihan | Catatan |
| --- | --- | --- |
| `type` | `income` / `expense` | filter opsional |

**Response 200**

```json
{
  "data": [
    {
      "id": "ckxxx",
      "tenantId": "ckyyy",
      "name": "Makan",
      "type": "expense",
      "isDefault": true,
      "status": "active",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

Order: `type ASC, isDefault DESC, name ASC`.

## POST `/categories`

Buat kategori baru.

**Request body**

```json
{ "name": "Konsultasi", "type": "expense" }
```

| Field | Tipe | Wajib |
| --- | --- | --- |
| `name` | string ≥ 1 | ya |
| `type` | `income` / `expense` | ya |

**Validasi**:
- Tidak boleh ada kategori lain di tenant ini dengan `name` + `type` yang sama (case-sensitive eksak — `Makan` ≠ `makan`). Jika ada → 409 "Kategori sudah ada".

**Response 201**

```json
{ "data": { ...category, "isDefault": false, "status": "active" } }
```

## GET `/categories/:id`

Detail satu kategori.

**Response 200** — satu objek di `data`. **Error** 404 jika tidak ditemukan.

## PATCH `/categories/:id`

Update kategori.

**Request body** (semua opsional)

```json
{ "name": "Makan Siang", "status": "active" }
```

| Field | Tipe | Catatan |
| --- | --- | --- |
| `name` | string ≥ 1 | |
| `status` | `active` / `inactive` | |

`type` tidak bisa diubah lewat endpoint ini (untuk mencegah pelanggaran invariant kategori-tipe transaksi).

## DELETE `/categories/:id`

Hapus atau soft-deactivate.

**Logika**:
- Jika tidak punya transaksi → hard delete.
- Jika punya transaksi → set `status='inactive'`.

**Response 200**

Hard delete: `{ "message": "Kategori dihapus" }`.

Soft deactivate: `{ "data": { ...category status:inactive }, "message": "Kategori dinonaktifkan karena sudah digunakan" }`.

## Lanjut baca

- [Domain keuangan](../../explanation/04-domain-keuangan.md) — kategori vs tipe transaksi.
- [API: Transactions](./transactions.md).
