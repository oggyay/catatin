# How-to: Rollback Migrasi Database

> Kuadran: **How-to** — cara membatalkan migrasi Prisma yang baru dibuat, baik di development maupun di environment yang sudah punya data.

> ⚠️ Migrasi yang sudah di-apply ke production **tidak punya rollback otomatis** di Prisma. Selalu lakukan langkah pemulihan dengan migrasi baru, bukan menghapus migrasi.

## Kasus 1: Rollback di lokal sebelum commit

Saat baru `npm run db:migrate -- --name foo` dan langsung sadar ada error.

### Opsi A: ulang dari awal (data hilang)

```bash
cd backend
npm run db:reset    # prisma migrate reset --force
```

Akan:
- Drop semua tabel.
- Re-apply semua migrasi termasuk yang baru.
- Jalankan seed (`prisma/seed.js`).

Aman di lokal, **tidak boleh dilakukan di shared DB**.

### Opsi B: rollback manual

1. Hapus folder migrasi terbaru: `rm -rf prisma/migrations/{timestamp}_foo`.
2. Hapus baris terkait dari tabel `_prisma_migrations`:

```bash
npx prisma db execute --stdin <<SQL
DELETE FROM "_prisma_migrations" WHERE migration_name = '{timestamp}_foo';
SQL
```

3. Jalankan SQL revert manual untuk DROP/REVERT yang sudah ke-apply (lihat `migration.sql` yang baru saja dihapus untuk tahu apa yang perlu di-revert).
4. `npx prisma generate` untuk regenerate client.

Opsi A lebih cepat di lokal; Opsi B berguna jika perlu mempertahankan data lokal.

## Kasus 2: Rollback di staging / production

Pola: **buat migrasi forward yang membatalkan perubahan**, jangan hapus migrasi lama.

### Skenario: kolom yang baru ditambah perlu dihapus

Migrasi 1 (sudah di-apply) menambah kolom:

```sql
ALTER TABLE "Tenant" ADD COLUMN "color" TEXT;
```

Migrasi 2 (baru) untuk menghapus:

```bash
npx prisma migrate dev --create-only --name drop_tenant_color
```

Edit `prisma/migrations/{ts}_drop_tenant_color/migration.sql`:

```sql
ALTER TABLE "Tenant" DROP COLUMN "color";
```

Lalu update `schema.prisma` (hapus field `color`), commit, deploy → `prisma migrate deploy` di server.

### Skenario: kolom yang baru di-rename salah

Tidak menjalankan rename langsung. Lakukan **expand → contract**:

1. Migrasi: tambah kolom baru, copy data.
2. Update kode untuk pakai kolom baru.
3. Migrasi: drop kolom lama.

## Kasus 3: Migrasi gagal di tengah jalan (production)

Symptom: `prisma migrate deploy` exit dengan error, beberapa statement sudah di-apply.

1. **Stop traffic**. Service dengan schema partial dapat menyebabkan error.
2. **Inspect tabel `_prisma_migrations`**:

```sql
SELECT migration_name, started_at, finished_at, applied_steps_count, logs
FROM "_prisma_migrations"
ORDER BY started_at DESC LIMIT 5;
```

`finished_at IS NULL` → migrasi tergantung di tengah.

3. **Kembalikan manual**: jalankan SQL revert untuk statement yang sudah ke-apply (cek `migration.sql` partially executed).
4. **Mark sebagai rolled back**:

```sql
DELETE FROM "_prisma_migrations" WHERE migration_name = '{nama}';
```

5. **Perbaiki migrasi**: fix `migration.sql` agar reproducible.
6. **Re-deploy**.

> Karena ini berisiko, **selalu backup DB sebelum deploy**.

## Backup sebelum migrasi production

```bash
# di server / pod yang punya akses DB
pg_dump --format=custom \
  --no-owner --no-privileges \
  --dbname=$DATABASE_URL \
  --file=backup-$(date +%Y%m%d-%H%M%S).dump
```

Restore:

```bash
pg_restore --clean --if-exists \
  --no-owner --no-privileges \
  --dbname=$DATABASE_URL \
  backup-20260526-104533.dump
```

## Pencegahan

- **Test migrasi di staging** dengan data sample sebelum production.
- **Hindari `migrate dev` di production**. Pakai `migrate deploy` (read-only terhadap schema, hanya apply).
- **Pisahkan "schema change" dan "code change"** kalau memungkinkan: deploy schema dulu, baru deploy code yang memakainya. Atau pola expand-and-contract.
- **Code review wajib** untuk file `migration.sql` — terutama yang ada `DROP`, `ALTER COLUMN`, `RENAME`.

## Lanjut baca

- [How-to: tambah tabel Prisma](./tambah-tabel-prisma.md).
- [How-to: deploy ke produksi](./deploy-produksi.md).
- [Database schema](../reference/database-schema.md).
