# Roadmap

> Daftar gagasan pengembangan yang **belum** dikerjakan, di-rangking berdasarkan dampak vs effort. Bisa jadi titik mulai diskusi roadmap formal.

> Status item ini bersifat indikatif. Sebelum mengeksekusi, sesuaikan prioritas dengan tim dan masukan pengguna.

## Sudah dibangun (sebagai konteks)

Ringkas: lihat [PRD Ringkas](./prd-ringkas.md#fitur-inti-yang-sudah-dibangun).

## Pending — quick wins

Item yang relatif kecil tapi langsung memperbaiki UX/keandalan.

| # | Item | Dampak | Effort | Catatan |
| --- | --- | --- | --- | --- |
| 1 | Aktifkan multipart upload bukti transaksi | Sedang | Kecil | Skema sudah ada (`Transaction.attachmentUrl`); butuh re-enable multer di route. |
| 2 | Validation error 400 yang seragam (tangkap `ZodError` di errorHandler) | Sedang | Kecil | Saat ini 500 untuk validation kadang muncul. Lihat `utils/error.js`. |
| 3 | Hide tombol mutasi (edit role / delete user) untuk non-owner di UI | Kecil | Kecil | Backend sudah menolak; UI cleanup. |
| 4 | Tambah kolom `tokenVersion` di User untuk revoke session | Sedang | Sedang | Mendukung "logout from all devices". |
| 5 | Test runner (Vitest) + smoke test parser & service | Tinggi | Sedang | Belum ada test harness sama sekali. |
| 6 | Setting timezone tenant (`Tenant.timezone`) | Sedang | Sedang | Saat ini timezone server; multi-tenant ke depannya butuh per-tenant TZ. |
| 7 | Notifikasi pending expired di web | Kecil | Kecil | Saat ini pending hanya ber-status `expired` tanpa ada UI peringatan. |

## Pending — fitur menengah

| # | Item | Dampak | Effort |
| --- | --- | --- | --- |
| 8 | Edit transaksi via WhatsApp | Sedang | Sedang |
| 9 | Reminder proaktif dari bot (saldo rendah, target tabungan) | Tinggi | Sedang |
| 10 | Insight harian / mingguan otomatis (kategori melonjak, dll) | Tinggi | Sedang |
| 11 | Notifikasi konfirmasi delivered/read (jika gateway support) | Sedang | Sedang |
| 12 | Tutup buku bulanan (snapshot saldo + lock periode) | Tinggi | Tinggi |
| 13 | Multi-currency (asumsi: tetap IDR utama) | Sedang | Tinggi |
| 14 | Kategori bertingkat (parent/child) | Sedang | Tinggi |
| 15 | Tag pada transaksi (selain kategori) | Sedang | Sedang |
| 16 | Recurring transactions (sewa bulanan, gaji) | Tinggi | Sedang |

## Pending — channel & integrasi

| # | Item | Dampak | Effort |
| --- | --- | --- | --- |
| 17 | Telegram bot (pakai adapter pattern yang sama) | Sedang | Sedang |
| 18 | Email login / recovery | Sedang | Sedang |
| 19 | Voice note → transkripsi → parse | Tinggi | Tinggi |
| 20 | Image OCR struk → auto-fill transaksi | Tinggi | Tinggi |
| 21 | Export ke software akuntansi (Accurate, Jurnal, Zoho) | Sedang | Tinggi |
| 22 | API publik untuk integrator (key, scopes) | Sedang | Tinggi |

## Pending — infrastruktur

| # | Item | Dampak | Effort | Catatan |
| --- | --- | --- | --- | --- |
| 23 | Queue worker untuk WhatsApp bot (BullMQ / Redis Streams) | Tinggi | Sedang | Mempersiapkan multi-instance, retry, dead-letter. Lihat ADR-007. |
| 24 | Dedup webhook lewat Redis (bukan in-memory) | Sedang | Kecil | Multi-pod safe. |
| 25 | Object storage untuk uploads (S3-compatible) | Sedang | Sedang | Volume lokal tidak scale. |
| 26 | Observability: structured logs + metrics + traces | Tinggi | Sedang | Loki / Prometheus / OTel. |
| 27 | Backup otomatis + restore drill | Tinggi | Kecil | Skrip cron + dokumentasi. |
| 28 | Migrasi ke schema-per-tenant atau RLS Postgres | Tinggi | Tinggi | Untuk enterprise customer. Lihat ADR-009. |

## Pending — mobile

Mobile saat ini struktur ada tapi belum sebanding fungsionalitasnya dengan web.

| # | Item | Dampak | Effort |
| --- | --- | --- | --- |
| 29 | Lengkapi semua screen mobile sesuai web | Tinggi | Tinggi |
| 30 | Push notifikasi (FCM) | Sedang | Sedang |
| 31 | Multi-tenant switcher di mobile | Sedang | Sedang |
| 32 | Versi iOS (lewat KMP atau Flutter rewrite) | Sedang | Sangat Tinggi |

## Pending — desain UX

| # | Item | Dampak | Effort |
| --- | --- | --- | --- |
| 33 | Frontend design system (komponen reusable, design tokens) | Sedang | Sedang |
| 34 | Onboarding tour untuk pemilik UMKM | Tinggi | Sedang |
| 35 | Empty states yang lebih informatif | Sedang | Kecil |
| 36 | Dark mode | Kecil | Kecil |
| 37 | Localization i18n (struktur saja, fallback Indonesia) | Sedang | Sedang |

## Long-term / eksperimental

- LLM lokal untuk parser (kurangi cost OpenAI).
- AI summary keuangan: "Bulan ini omzet kamu naik 12%, biaya tertinggi Operasional".
- Forecasting cashflow.
- Goal tracking (tabungan target, dana darurat).

## Cara mengusulkan item baru

1. Diskusikan dampak (siapa terbantu, masalah apa yang dipecahkan).
2. Estimasi kasar effort (kecil/sedang/tinggi).
3. Cek ADR — apakah keputusan arsitektur mendukung atau perlu di-revisit.
4. Tambahkan ke section yang sesuai di file ini lewat PR.

## Lanjut baca

- [PRD Ringkas](./prd-ringkas.md).
- [ADR ringkas](./explanation/09-keputusan-arsitektur.md).
- [Glosarium](./glossary.md).
