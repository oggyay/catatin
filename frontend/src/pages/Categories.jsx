import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../lib/api.js';
import Modal from '../components/Modal.jsx';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', type: 'expense' });
  const [tab, setTab] = useState('expense');

  const load = async () => {
    const { data } = await api.get('/categories');
    setCategories(data.data);
  };
  useEffect(() => { load(); }, []);

  const filtered = categories.filter((c) => c.type === tab);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', type: tab });
    setShowForm(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({ name: c.name, type: c.type });
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.patch(`/categories/${editing.id}`, { name: form.name });
        toast.success('Kategori diperbarui');
      } else {
        await api.post('/categories', form);
        toast.success('Kategori ditambahkan');
      }
      setShowForm(false);
      load();
    } catch {}
  };

  const toggleStatus = async (c) => {
    try {
      await api.patch(`/categories/${c.id}`, { status: c.status === 'active' ? 'inactive' : 'active' });
      load();
    } catch {}
  };

  const del = async (c) => {
    if (!confirm(`Hapus/nonaktifkan kategori ${c.name}?`)) return;
    try {
      await api.delete(`/categories/${c.id}`);
      load();
    } catch {}
  };

  return (
    <div className="page categories-page">
      <div className="transactions-hero mb-24">
        <div>
          <div className="eyebrow">Organisasi</div>
          <h1 className="page-title">Kategori</h1>
          <p>Kelompokkan transaksi supaya laporan lebih bermakna.</p>
        </div>
        <div className="hero-actions">
          <button onClick={openNew}>+ Tambah Kategori</button>
        </div>
      </div>

      <div className="card">
        <div className="tabs">
          <button className={tab === 'expense' ? 'active' : ''} onClick={() => setTab('expense')}>Pengeluaran</button>
          <button className={tab === 'income' ? 'active' : ''} onClick={() => setTab('income')}>Pemasukan</button>
        </div>

        <div className="categories-grid">
          {filtered.map((c) => (
            <div className="category-item" key={c.id}>
              <div className="category-item-main">
                <div className={`recent-icon ${c.type}`}>{c.type === 'income' ? '+' : '-'}</div>
                <div>
                  <div className="recent-title">{c.name}</div>
                  <div className="recent-meta">{c.isDefault ? 'Default' : 'Custom'} · <span className={'badge ' + c.status}>{c.status}</span></div>
                </div>
              </div>
              <div className="transaction-actions">
                <button className="ghost small" onClick={() => openEdit(c)}>Edit</button>
                <button className="ghost small" onClick={() => toggleStatus(c)}>{c.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}</button>
                <button className="ghost small" onClick={() => del(c)}>Hapus</button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="empty">Belum ada kategori.</div>}
        </div>
      </div>

      {showForm && (
        <Modal
          title={editing ? 'Edit Kategori' : 'Tambah Kategori'}
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button type="button" className="secondary" onClick={() => setShowForm(false)}>Batal</button>
              <button form="cat-form" type="submit">Simpan</button>
            </>
          }
        >
          <form id="cat-form" onSubmit={save}>
            <div className="field">
              <label>Nama</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            {!editing && (
              <div className="field">
                <label>Tipe</label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="expense">Pengeluaran</option>
                  <option value="income">Pemasukan</option>
                </select>
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}
