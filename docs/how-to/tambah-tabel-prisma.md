# How-to: Tambah Tabel atau Kolom Prisma

> Kuadran: **How-to** — alur menambah model/field di skema Prisma + migrasi + propagasi ke service.

## Prasyarat

- PostgreSQL berjalan dan `DATABASE_URL` valid.
- Bekerja di branch baru (jangan di `main`).
- Backup data sebelum migrasi schema yang destruktif.

## Resep cepat

### 1. Edit `backend/prisma/schema.prisma`

Tambah model atau field. Contoh menambah model `Reminder`:

```prisma
model Reminder {
  id              String   @id @default(cuid())
  tenantId        String
  userId          String
  title           String
  amount          Decimal  @db.Decimal(18, 2)
  reminderDate    DateTime
  status          String   @default("pending") // pending | done | cancelled
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  tenant          Tenant   @relation(fields: [tenantId], references: [id])
  user            User     @relation(fields: [userId], references: [id])

  @@index([tenantId, reminderDate])
  @@index([userId, status])
}
```

Pastikan menambahkan **index** untuk field yang sering difilter, terutama `tenantId`.

### 2. Tambah back-relation di model existing

Prisma butuh relasi dua arah. Edit `Tenant` & `User`:

```prisma
model Tenant {
  // ... existing fields
  reminders   Reminder[]
}

model User {
  // ... existing fields
  reminders   Reminder[]
}
```

### 3. Validasi schema sebelum migrasi

```bash
cd backend
npx prisma validate
npx prisma format       # rapikan formatting
```

### 4. Generate migrasi

```bash
npm run db:migrate -- --name add_reminder
```

Prisma akan:
- Membuat folder `prisma/migrations/{timestamp}_add_reminder/`.
- Menulis `migration.sql`.
- Menjalankan migrasi terhadap DB lokal.
- Re-generate Prisma Client.

Inspeksi `migration.sql` sebelum commit. Untuk perubahan destruktif (drop column, rename), pertimbangkan **manual SQL editing** untuk preserve data.

### 5. Re-generate client (kalau perlu manual)

```bash
npm run db:generate
```

Editor Anda mungkin perlu restart TypeScript server agar typing baru terdeteksi.

### 6. Update seed (opsional)

Jika field/model baru perlu data default untuk tenant baru, edit `backend/prisma/seed.js` dan/atau handler register di `routes/auth.routes.js` (untuk self-service tenant) dan `routes/admin.routes.js` (untuk admin platform create).

### 7. Tulis service / route

Operasi yang melibatkan saldo wajib lewat `transaction.service.js`. Untuk model baru (Reminder, Notification, dll.), boleh akses Prisma langsung dari route, tapi tetap **filter `tenantId: req.tenantId`**.

### 8. Update dokumentasi

- `docs/reference/database-schema.md` — tambah section model baru.
- `docs/reference/api/...md` — endpoint baru (jika ada).

## Skenario: tambah kolom ke model existing

Misalnya menambah `Tenant.timezone`:

```prisma
model Tenant {
  // ...
  timezone   String   @default("Asia/Jakarta")
}
```

Setelah `db:migrate`:
- Semua tenant existing akan punya `timezone = "Asia/Jakarta"` (karena `@default`).
- Endpoint `PATCH /settings/tenant` tidak otomatis menerima field baru — perlu update zod schema:

```js
const tenantSchema = z.object({
  name: z.string().min(2).optional(),
  type: z.enum(['personal', 'umkm']).optional(),
  timezone: z.string().optional(),
});
```

## Skenario: rename / drop kolom

Lebih berisiko karena data hilang. Pola aman ("expand and contract"):

1. **Expand**: tambah kolom baru, biarkan kolom lama tetap ada.
2. Update kode untuk write ke kolom baru, read dari keduanya.
3. Backfill data lama → kolom baru (script di `backend/scripts/`).
4. Update kode hanya pakai kolom baru.
5. **Contract**: drop kolom lama di migrasi terpisah.

Lihat `backend/scripts/backfill-identities.mjs` sebagai contoh script backfill.

## Skenario: migrasi data dengan SQL custom

Buat migrasi kosong:

```bash
npx prisma migrate dev --create-only --name backfill_foo
```

Lalu edit `prisma/migrations/{timestamp}_backfill_foo/migration.sql` dengan SQL kustom (UPDATE, INSERT, dll). Apply dengan:

```bash
npx prisma migrate dev
```

## Rollback

Lihat [How-to: rollback migrasi](./rollback-migrasi.md).

## Checklist akhir

- [ ] `npx prisma format` rapi.
- [ ] `npx prisma validate` bersih.
- [ ] Migration file ter-commit (folder `prisma/migrations/...`).
- [ ] Index pada `tenantId` ditambahkan (untuk model multi-tenant).
- [ ] Seed disesuaikan jika perlu.
- [ ] Service / route memakai schema baru dengan zod validation.
- [ ] `docs/reference/database-schema.md` di-update.
- [ ] Test end-to-end pada DB lokal sebelum push.

## Lanjut baca

- [Database schema](../reference/database-schema.md).
- [How-to: tambah endpoint](./tambah-endpoint-api.md).
- [How-to: rollback migrasi](./rollback-migrasi.md).
