# Frontend Komponen Reusable

> Kuadran: **Reference** — daftar komponen reusable di `frontend/src/components/` beserta props penting.

Frontend CatatIN berukuran kecil dan tidak punya design system formal. Komponen reusable hanya beberapa, lebih banyak logic ada di file `pages/*.jsx`. Saat redesign, file-file ini adalah titik mulai yang baik.

## `AppLayout.jsx`

Layout shell aplikasi: sidebar + main content. Menerima outlet dari React Router.

**Props**

| Prop | Tipe | Default | Catatan |
| --- | --- | --- | --- |
| `platformAdmin` | boolean | `false` | Render sidebar admin (Tenants, Usage) alih-alih sidebar user. |

**Tanggung jawab**:
- Render sidebar dengan grouping `navUser`, `navSettings`, atau `navAdmin`.
- Tenant switcher (dropdown) di footer sidebar jika user punya > 1 tenant.
- Tombol "Buat Tenant Baru" + modal pembuat tenant.
- Modal "Aktifkan WhatsApp" (muncul sekali setelah login berdasarkan `sessionStorage`).
- Tombol logout.

Saat redesign, **pisahkan navigation config** dari komponen ini ke file constant supaya audit dan permissioning lebih mudah.

## `Modal.jsx`

Modal generik dengan backdrop, ESC handler, dan slot footer. Dipakai untuk semua dialog di aplikasi (edit transaksi, transfer, link WhatsApp, dll).

**Props**

| Prop | Tipe | Catatan |
| --- | --- | --- |
| `title` | string | Heading di header modal. |
| `onClose` | () => void | Dipanggil saat backdrop / tombol close diklik. |
| `footer` | ReactNode | Slot tombol footer (mis. Batal + Simpan). |
| `children` | ReactNode | Body konten modal. |

Lihat `frontend/src/components/Modal.jsx` untuk implementasi lengkap. Tidak ada animasi; redesign bisa menambahkan transition.

## `MoneyInput.jsx`

Input nominal dengan format IDR otomatis (separator titik per ribuan). Dipakai di form transaksi dan transfer.

**Props**

| Prop | Tipe | Catatan |
| --- | --- | --- |
| `value` | number / string | nilai nominal mentah. |
| `onChange` | (next: number) => void | dipanggil dengan angka tanpa format. |
| `placeholder` | string | opsional. |
| `required` | boolean | opsional. |

Catatan: parser internal me-strip karakter non-digit. Tidak mendukung desimal (`,5`), karena nominal di CatatIN selalu bilangan bulat rupiah.

## `TransactionForm.jsx`

Form create transaksi standalone, dipakai di `pages/NewTransaction.jsx`. Memiliki field tipe, akun, kategori, tanggal, nominal, deskripsi.

**Props** (kira-kira)

| Prop | Tipe | Catatan |
| --- | --- | --- |
| `accounts` | Account[] | daftar akun aktif. |
| `categories` | Category[] | daftar kategori. |
| `onSubmit` | (payload) => Promise<void> | dipanggil dengan body siap-API. |
| `submitting` | boolean | flag loading untuk disable tombol. |

> Karena ini form yang dipakai di lebih dari satu tempat (page + modal), **konsolidasikan logic** ke hook saat redesign agar tidak duplikasi state antara `TransactionForm` dan `TransactionCreateModal`.

## `TransactionCreateModal.jsx`

Wrapper modal untuk pengalaman "tambah cepat" dari halaman Dashboard / Transactions tanpa perlu navigasi.

**Props**

| Prop | Tipe | Catatan |
| --- | --- | --- |
| `open` | boolean | kontrol visibilitas. |
| `onClose` | () => void | dipanggil saat user batal/click backdrop. |
| `onSuccess` | () => void | dipanggil setelah `POST /transactions` berhasil; biasanya untuk reload list. |

Komponen ini fetch akun & kategori sendiri saat di-open (lihat `useEffect`).

## Aturan styling

- File CSS tunggal: `frontend/src/styles.css` (sekitar 33 KB). Tidak ada CSS-in-JS / Tailwind.
- Class-based: nama class deskriptif (`dashboard-page`, `recent-list`, `kpi`, `card`, `modal-backdrop`, dst.).
- Dark/light: belum ada theme switching; warna utama hardcoded.

Saat redesign, dua pilihan praktis:
- **Refactor incremental**: ekstrak komponen ke `components/` dan pisahkan styles ke per-component CSS module.
- **Adopsi design system**: Tailwind / Radix / shadcn-ui. Berarti reorganisasi struktur folder.

## Komponen yang sebaiknya ditambahkan saat redesign

Berdasarkan duplikasi yang terlihat di pages:

- **`PageHeader`** — judul + eyebrow + actions (sekarang inline di setiap page).
- **`Card` / `Section`** — wrapper card + section-head (mengulang di `Dashboard`, `Transactions`, dst.).
- **`Filters`** — toolbar filter (di `Transactions`, `CashflowReport`).
- **`Empty`** — state kosong (sekarang `<div className="empty">` polos).
- **`AccountSelect` / `CategorySelect`** — select dengan filter status active.

## Lanjut baca

- [Frontend routes](./frontend-routes.md).
- [How-to: tambah halaman frontend](../how-to/tambah-halaman-frontend.md).
