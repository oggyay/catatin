import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api.js';
import { formatDate } from '../lib/format.js';
import Modal from '../components/Modal.jsx';

export default function AdminTenants() {
  const [tenants, setTenants] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'personal',
    ownerName: '',
    ownerWhatsappNumber: '',
    subscriptionPlan: 'free',
    subscriptionStatus: 'trial',
    trialEndsAt: '',
  });

  const load = async () => {
    const { data } = await api.get('/admin/tenants');
    setTenants(data.data);
  };

  useEffect(() => {
    load();
  }, []);

  const openForm = () => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setForm({
      name: '',
      type: 'personal',
      ownerName: '',
      ownerWhatsappNumber: '',
      subscriptionPlan: 'free',
      subscriptionStatus: 'trial',
      trialEndsAt: d.toISOString().slice(0, 10),
    });
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/tenants', {
        ...form,
        trialEndsAt: form.trialEndsAt ? new Date(`${form.trialEndsAt}T23:59:59`).toISOString() : null,
      });
      toast.success('Tenant ditambahkan');
      setShowForm(false);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Gagal menambah tenant');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head mb-16">
        <h1 className="page-title">Daftar Tenant</h1>
        <button onClick={openForm}>+ Tambah Tenant</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Tipe</th>
                <th>Paket</th>
                <th>Subscription</th>
                <th>User</th>
                <th>Transaksi</th>
                <th>Status</th>
                <th>Dibuat</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.type === 'umkm' ? 'UMKM' : 'Personal'}</td>
                  <td>{t.subscriptionPlan}</td>
                  <td>{t.subscriptionStatus}</td>
                  <td>{t.usersCount}</td>
                  <td>{t.transactionsCount}</td>
                  <td><span className={'badge ' + t.status}>{t.status}</span></td>
                  <td>{formatDate(t.createdAt)}</td>
                  <td><Link to={`/admin/tenants/${t.id}`}>Detail</Link></td>
                </tr>
              ))}
              {tenants.length === 0 && <tr><td colSpan="9" className="empty">Belum ada tenant.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <Modal
          title="Tambah Tenant"
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button type="button" className="secondary" onClick={() => setShowForm(false)}>Batal</button>
              <button form="tenant-form" type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
            </>
          }
        >
          <form id="tenant-form" onSubmit={save}>
            <div className="field">
              <label>Nama Tenant/Bisnis</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>Tipe</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="personal">Personal</option>
                <option value="umkm">UMKM</option>
              </select>
            </div>
            <div className="field">
              <label>Nama Owner</label>
              <input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} required />
            </div>
            <div className="field">
              <label>Nomor WhatsApp Owner</label>
              <input value={form.ownerWhatsappNumber} onChange={(e) => setForm({ ...form, ownerWhatsappNumber: e.target.value })} required />
            </div>
            <div className="form-grid-2">
              <div className="field">
                <label>Paket</label>
                <select value={form.subscriptionPlan} onChange={(e) => setForm({ ...form, subscriptionPlan: e.target.value })}>
                  <option value="free">free</option>
                  <option value="basic">basic</option>
                  <option value="pro">pro</option>
                </select>
              </div>
              <div className="field">
                <label>Status Subscription</label>
                <select value={form.subscriptionStatus} onChange={(e) => setForm({ ...form, subscriptionStatus: e.target.value })}>
                  <option value="trial">trial</option>
                  <option value="active">active</option>
                  <option value="suspended">suspended</option>
                  <option value="inactive">inactive</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Trial sampai</label>
              <input type="date" value={form.trialEndsAt} onChange={(e) => setForm({ ...form, trialEndsAt: e.target.value })} />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
