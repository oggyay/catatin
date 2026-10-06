# Rencana Komprehensif Finapp (CatatIN)
*Adopsi Fitur Budggt (Life Goals) + Modul Cashflow Budgeting (Proyeksi vs Realisasi)*

---

## 1. Latar Belakang & Evaluasi Konsep

Di aplikasi pencatatan keuangan modern (seperti *Budggt*, *YNAB / You Need A Budget*, dan *Copilot*), terdapat 2 pilar utama yang saling melengkapi:

1. **Pilar Jangka Panjang (Life Goals & Sinking Funds):**
   - Menjaga fokus pada aset masa depan: Dana Darurat, Tabungan Rumah, Pendidikan Anak, Kendaraan.
   - Perhitungan dana darurat dinamis berbasis rata-rata pengeluaran riil bulanan.
2. **Pilar Operasional Bulanan (Proyeksi vs Realisasi / Cashflow Planning):**
   - Merencanakan aliran uang sebelum bulan berjalan dimulai: apa saja pendapatan yang diharapkan masuk (*projected inflow*) dan pos pengeluaran/tagihan apa saja yang wajib dibayarkan (*projected outflow*).
   - Memantau realisasi harian secara otomatis: pos mana yang sudah lunas, pos mana yang membengkak (*overbudget*), dan berapa sisa uang bebas (*unallocated cash*).

---

## 2. Modul Proyeksi vs Realisasi (Planned Cashflow vs Actual)

Fitur ini menjawab kebutuhan: *"Bulan depan uang masuk berapa, akan dipakai bayar apa saja, dan bagaimana realisasinya di lapangan?"*

### A. Alur Kerja (Workflow) Perencanaan Bulanan

1. **Awal Periode (Tahap Proyeksi / Planning):**
   - **Proyeksi Pendapatan (Expected Inflow):**
     - Gaji Pokok: Rp 10.000.000
     - Tukin / Insentif: Rp 5.000.000
     - *Total Proyeksi Pemasukan:* Rp 15.000.000
   - **Proyeksi Pengeluaran & Komitmen (Planned Outflow):**
     - *Kategori Fixed Bills (Tagihan Wajib):*
       - SPP Sekolah Anak (Due: Tgl 10): Rp 1.500.000
       - Listrik PLN & Air (Due: Tgl 15): Rp 600.000
       - Internet / WiFi (Due: Tgl 20): Rp 350.000
     - *Kategori Flexible / Living Expenses (Plafon Batas):*
       - Belanja Dapur & Makan: Rp 4.000.000
       - Bensin & Operasional: Rp 1.000.000
     - *Alokasi Goals (Disisihkan ke Aset):*
       - Tabungan Pendidikan Anak: Rp 2.400.000
       - Tabungan Rumah Impian: Rp 2.000.000
       - Dana Darurat: Rp 1.000.000
     - *Total Proyeksi Pengeluaran + Tabungan:* Rp 12.850.000
     - **Buffer / Unallocated Cash:** Rp 2.150.000

2. **Sepanjang Bulan (Tahap Realisasi / Actual Tracking):**
   - Setiap transaksi yang dicatat via Web atau Bot WhatsApp otomatis dihubungkan ke pos anggaran bulan tersebut.
   - Sistem membandingkan:
     $$\text{Selisih (Variance)} = \text{Proyeksi} - \text{Realisasi}$$
   - Status Pos:
     - Tagihan Wajib: `Belum Dibayar` $\rightarrow$ `Lunas` (Begitu transaksi pembayaran dicatat).
     - Plafon Belanja: Menampilkan persentase pemakaian (`Normal` $\le 80\%$, `Waspada` $81-99\%$, `Overbudget` $\ge 100\%$).

---

## 3. Matriks Visualisasi Dashboard (Web & Mobile)

Tampilan tabel perbandingan interaktif pada Dashboard Finapp:

| Kategori / Pos | Tanggal Jatuh Tempo | Proyeksi (Anggaran) | Realisasi (Aktual) | Sisa / Selisih | Status |
|---|---|---|---|---|---|
| **Pemasukan:** | | | | | |
| Gaji Pokok | 01 Okt 2026 | Rp 10.000.000 | Rp 10.000.000 | Rp 0 | ✅ Diterima |
| Tunjangan Kinerja | 05 Okt 2026 | Rp 5.000.000 | Rp 5.000.000 | Rp 0 | ✅ Diterima |
| **Pengeluaran Wajib (Bills):** | | | | | |
| SPP Sekolah Anak | 10 Okt 2026 | Rp 1.500.000 | Rp 1.500.000 | Rp 0 | ✅ Lunas |
| Listrik & Air PAM | 15 Okt 2026 | Rp 600.000 | Rp 0 | Rp 600.000 | ⏳ Menunggu Bayar |
| Internet / WiFi | 20 Okt 2026 | Rp 350.000 | Rp 0 | Rp 350.000 | ⏳ Menunggu Bayar |
| **Plafon Biaya Hidup:** | | | | | |
| Belanja Makanan | Sepanjang Bulan | Rp 4.000.000 | Rp 2.850.000 | Rp 1.150.000 | 🟢 71% (Aman) |
| Transport & Bensin | Sepanjang Bulan | Rp 1.000.000 | Rp 920.000 | Rp 80.000 | 🟡 92% (Waspada) |
| **Alokasi Goals / Tabungan:** | | | | | |
| Pendidikan Anak | Pasca Gajian | Rp 2.400.000 | Rp 2.400.000 | Rp 0 | 🎯 Disetor |
| Rumah Impian | Pasca Gajian | Rp 2.000.000 | Rp 2.000.000 | Rp 0 | 🎯 Disetor |
| Dana Darurat | Pasca Gajian | Rp 1.000.000 | Rp 1.000.000 | Rp 0 | 🎯 Disetor |

---

## 4. Keunggulan Integrasi WhatsApp Bot pada Modul Proyeksi

Dengan adanya WhatsApp Bot (WAHA Gateway), interaksi Proyeksi vs Realisasi berjalan proaktif:

1. **Peringatan Batas Anggaran Realtime (*Budget Guard Alert*):**
   - Saat pengguna mencatat: `bensin 100rb bca`
   - Bot membalas:
     ```text
     ✅ Pengeluaran dicatat: Bensin Rp 100.000 (BCA)
     ⚠️ Perhatian: Kategori Transport telah mencapai 92% dari proyeksi anggaran (Sisa jatah bulan ini: Rp 80.000).
     ```

2. **Daftar Tagihan Belum Realisasi (*Upcoming Bills Digest*):**
   - Perintah: `tagihan` atau `proyeksi`
   - Bot membalas:
     ```text
     📋 Pengeluaran Terencana Belum Realisasi (Oktober 2026):
     • ⏳ Listrik & Air: Rp 600.000 (Due: 15 Okt)
     • ⏳ Internet: Rp 350.000 (Due: 20 Okt)
     Total komitmen yang harus dibayar: Rp 950.000
     ```

3. **Kemudahan Copy-Budget dari Bulan Sebelumnya:**
   - Di awal bulan baru, pengguna cukup menekan satu tombol di web atau mengetik `duplikat anggaran` di WA untuk menyalin pola proyeksi bulan lalu ke bulan baru.

---

## 5. Rancangan Skema Database Baru (`schema.prisma`)

Tabel baru yang ditambahkan untuk mendukung modul Proyeksi vs Realisasi dan Life Goals:

```prisma
// =========================================
// MODUL 1: PROYEKSI & REALISASI (BUDGETING)
// =========================================

enum BudgetItemType {
  income
  expense_fixed    // Tagihan pasti (Listrik, SPP, Cicilan)
  expense_flexible // Plafon pengeluaran (Makan, Hiburan, Bensin)
  goal_allocation  // Alokasi ke pos tabungan impian
}

model MonthlyBudget {
  id            String          @id @default(cuid())
  tenantId      String
  period        String          // Format: "YYYY-MM", e.g. "2026-10"
  totalIncome   Decimal         @default(0) @db.Decimal(18, 2)
  totalExpense  Decimal         @default(0) @db.Decimal(18, 2)
  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  tenant        Tenant          @relation(fields: [tenantId], references: [id])
  items         BudgetItem[]

  @@unique([tenantId, period])
  @@index([tenantId])
}

model BudgetItem {
  id              String          @id @default(cuid())
  budgetId        String
  categoryId      String?         // Terhubung ke kategori transaksi
  goalId          String?         // Terhubung ke pos goal (jika tipe goal_allocation)
  name            String          // e.g. "Gaji Pokok", "SPP Sekolah", "Belanja Makan"
  type            BudgetItemType  @default(expense_flexible)
  plannedAmount   Decimal         @db.Decimal(18, 2)
  actualAmount    Decimal         @default(0) @db.Decimal(18, 2)
  dueDate         DateTime?       // Tanggal jatuh tempo tagihan
  isSettled       Boolean         @default(false)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  budget          MonthlyBudget   @relation(fields: [budgetId], references: [id], onDelete: Cascade)
  category        Category?       @relation(fields: [categoryId], references: [id])
  goal            FinancialGoal?  @relation(fields: [goalId], references: [id])

  @@index([budgetId])
}

// =========================================
// MODUL 2: LIFE GOALS & SINKING FUNDS (BUDGGT)
// =========================================

enum GoalType {
  emergency_fund
  home
  education
  vehicle
  investment
  custom
}

enum GoalStatus {
  in_progress
  achieved
  paused
}

model FinancialGoal {
  id              String          @id @default(cuid())
  tenantId        String
  name            String          // e.g. "Pendidikan Anak", "Rumah 2M"
  type            GoalType        @default(custom)
  targetAmount    Decimal         @db.Decimal(18, 2)
  currentAmount   Decimal         @default(0) @db.Decimal(18, 2)
  targetDate      DateTime?
  monthlyTarget   Decimal?        @db.Decimal(18, 2)
  status          GoalStatus      @default(in_progress)
  icon            String?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  tenant          Tenant          @relation(fields: [tenantId], references: [id])
  contributions   GoalContribution[]
  budgetItems     BudgetItem[]

  @@index([tenantId])
}

model GoalContribution {
  id              String          @id @default(cuid())
  goalId          String
  tenantId        String
  accountId       String          // Sumber dana (BCA, Mandiri, Cash)
  transactionId   String?
  amount          Decimal         @db.Decimal(18, 2)
  date            DateTime        @default(now())
  note            String?

  goal            FinancialGoal   @relation(fields: [goalId], references: [id], onDelete: Cascade)
  account         Account         @relation(fields: [accountId], references: [id])

  @@index([goalId])
  @@index([tenantId])
}
```

---

## 6. Roadmap Implementasi Bertahap

1. **Fase 1: Database & Engine Realisasi Otomatis**
   - Menerapkan schema `MonthlyBudget`, `BudgetItem`, dan `FinancialGoal`.
   - Membuat middleware/service yang otomatis memperbarui `actualAmount` pada `BudgetItem` setiap kali transaksi baru dibuat atau diubah.
2. **Fase 2: Backend API & Kalkulator**
   - Endpoint CRUD Budget Bulanan & Template Duplikasi Bulan.
   - Endpoint Kalkulator Dana Darurat Otomatis ($3\times - 6\times$ pengeluaran riil).
3. **Fase 3: Integrasi Bot WhatsApp**
   - Command `proyeksi` / `tagihan` untuk memeriksa pos yang belum dibayar.
   - Warning alert otomatis jika plafon kategori fleksibel hampir habis.
4. **Fase 4: Frontend Dashboard & PWA**
   - Halaman **Perencanaan Anggaran (Proyeksi vs Realisasi)** dengan tabel komparasi dan status warna.
   - Halaman **Target Finansial (Goals)** dengan progress bar visual.
   - Konfigurasi PWA (*Add to Home Screen*) untuk penggunaan mobile mandiri.
