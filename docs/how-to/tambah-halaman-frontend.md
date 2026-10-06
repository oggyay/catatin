# How-to: Tambah Halaman Frontend Baru

> Kuadran: **How-to** — alur menambah halaman React baru, route guard, link sidebar, dan fetching data.

Sasaran: tambah halaman `/audit-log` yang menampilkan history audit untuk owner/admin.

## Resep

### 1. Buat file komponen page

`frontend/src/pages/AuditLog.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { formatDate } from '../lib/format.js';

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.get('/audit-logs')
      .then(({ data }) => { if (active) setLogs(data.data); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Histori</div>
          <h1 className="page-title">Audit Log</h1>
          <p>Semua perubahan penting di tenant ini.</p>
        </div>
      </div>

      <div className="card">
        {loading && <div className="empty">Memuat...</div>}
        {!loading && logs.length === 0 && <div className="empty">Belum ada audit log.</div>}
        {!loading && logs.length > 0 && (
          <div className="recent-list">
            {logs.map((log) => (
              <div key={log.id} className="recent-item">
                <div className="recent-main">
                  <div>
                    <div className="recent-title">{log.action}</div>
                    <div className="recent-meta">{formatDate(log.createdAt)} · {log.entityType}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

Pola yang dipakai semua page:
- `api` instance dari `lib/api.js` (pasang token otomatis).
- State lokal `useState`; tidak ada state global.
- Loading guard dengan flag `active` untuk hindari setState setelah unmount.

### 2. Daftar di router

Edit `frontend/src/App.jsx`:

```jsx
import AuditLog from './pages/AuditLog.jsx';

// di dalam <Route element={<Protected><AppLayout /></Protected>}>:
<Route path="/audit-log" element={<AuditLog />} />
```

Untuk halaman admin platform, masukkan ke nested route bagian `<Route element={<Protected platformAdmin><AppLayout platformAdmin /></Protected>}>`.

### 3. Tambah link sidebar (optional)

Edit `frontend/src/components/AppLayout.jsx`. Tambah ke `navUser` atau `navSettings` tergantung kategori:

```js
const navSettings = [
  { to: '/settings/profile', label: 'Profil' },
  { to: '/settings/users', label: 'Pengguna', roles: ['owner', 'admin'] },
  { to: '/settings/subscription', label: 'Subscription' },
  { to: '/settings/whatsapp', label: 'WhatsApp' },
  { to: '/audit-log', label: 'Audit Log', roles: ['owner', 'admin'] },  // <-- baru
];
```

Property `roles` mem-filter visibilitas item.

### 4. Tambah endpoint backend (jika belum ada)

Buat endpoint `GET /api/audit-logs` jika belum tersedia. Lihat [How-to: tambah endpoint API](./tambah-endpoint-api.md). Filter `tenantId: req.tenantId`.

### 5. Styling

CatatIN punya satu file CSS global di `frontend/src/styles.css`. Tambahkan class baru di sana atau pakai class existing:

- `.page` — wrapper halaman.
- `.card` — kartu putih dengan padding & shadow.
- `.section-head`, `.eyebrow`, `.page-title` — header pattern.
- `.recent-list`, `.recent-item`, `.recent-title`, `.recent-meta` — list item pattern.
- `.empty` — empty state.
- `.kpi`, `.value`, `.label` — KPI card.

Lihat halaman existing (`Dashboard.jsx`, `Transactions.jsx`) untuk inspirasi.

### 6. Test

```bash
cd frontend && npm run dev
# buka http://localhost:5173/audit-log setelah login
```

## Pola data fetching

### Single fetch saat mount

```js
useEffect(() => {
  let active = true;
  api.get('/foo').then(({ data }) => active && setFoo(data.data));
  return () => { active = false; };
}, []);
```

### Fetch dengan dependency

```js
const load = useCallback(async () => {
  setLoading(true);
  try {
    const { data } = await api.get('/foo', { params: { period } });
    setFoo(data.data);
  } finally {
    setLoading(false);
  }
}, [period]);

useEffect(() => { load(); }, [load]);
```

Pola ini dipakai di `Dashboard.jsx`. Bagus karena bisa di-trigger ulang dari tombol `Refresh`.

### Mutation (POST/PATCH/DELETE)

```js
const onSave = async () => {
  try {
    await api.post('/foo', payload);
    toast.success('Tersimpan');
    load();  // reload data
  } catch (err) {
    // toast otomatis dari interceptor untuk 4xx/5xx
  }
};
```

`react-hot-toast` sudah ter-import di `lib/api.js`.

## Pola modal

Pakai komponen `Modal.jsx`:

```jsx
import Modal from '../components/Modal.jsx';

{showEdit && (
  <Modal
    title="Edit Foo"
    onClose={() => setShowEdit(false)}
    footer={
      <>
        <button className="secondary" onClick={() => setShowEdit(false)}>Batal</button>
        <button form="edit-foo-form" type="submit">Simpan</button>
      </>
    }
  >
    <form id="edit-foo-form" onSubmit={onSubmit}>
      {/* fields */}
    </form>
  </Modal>
)}
```

## Pola form

Untuk form kompleks (transaksi, transfer), pakai komponen reusable `TransactionForm.jsx` atau `MoneyInput.jsx`. Untuk form sederhana, inline di page.

## Tips redesign

- **Pisahkan layout dari konten.** Saat ini `AppLayout.jsx` melakukan banyak hal (sidebar, modal, prompt). Saat redesign, pertimbangkan ekstrak ke beberapa komponen kecil.
- **Pertimbangkan React Query** untuk caching server data. Saat ini setiap halaman re-fetch dari nol setiap mount.
- **Konsolidasi class CSS** ke design tokens (CSS variables) untuk theming.

## Lanjut baca

- [Frontend routes](../reference/frontend-routes.md).
- [Frontend komponen](../reference/frontend-komponen.md).
- [How-to: tambah endpoint API](./tambah-endpoint-api.md).
