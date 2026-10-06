import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../lib/api.js';
import Modal from '../components/Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function SettingsUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', whatsappNumber: '', role: 'member' });
  const canManageUsers = ['owner', 'admin'].includes(user?.role);
  const managedRoles = user?.role === 'owner' ? ['owner', 'member'] : ['admin', 'member'];
  const canChangeUser = (target) => target.id !== user?.id && !(user?.role === 'admin' && target.role === 'owner');

  const load = async () => {
    if (!canManageUsers) return;
    const { data } = await api.get('/settings/users');
    setUsers(data.data);
  };
  useEffect(() => { load(); }, [canManageUsers]);

  const save = async (e) => {
    e.preventDefault();
    if (!canManageUsers) return;
    try {
      await api.post('/settings/users', form);
      toast.success('User ditambahkan');
      setShowForm(false);
      setForm({ name: '', whatsappNumber: '', role: 'member' });
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Gagal menambah user');
    }
  };

  const toggle = async (u) => {
    if (!canManageUsers) return;
    try {
      await api.patch(`/settings/users/${u.id}`, { status: u.status === 'active' ? 'inactive' : 'active' });
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Gagal mengubah status user');
    }
  };

  const remove = async (u) => {
    if (!canManageUsers) return;
    if (!confirm(`Hapus user ${u.name}? Nomor WhatsApp akan bisa dipakai untuk daftar ulang.`)) return;
    try {
      await api.delete(`/settings/users/${u.id}`);
      toast.success('User dihapus');
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Gagal menghapus user');
    }
  };

  const changeRole = async (u, role) => {
    if (!canManageUsers) return;
    try {
      await api.patch(`/settings/users/${u.id}`, { role });
      toast.success('Role diperbarui');
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Gagal mengubah role');
    }
  };

  if (!canManageUsers) {
    return (
      <div className="page">
        <h1 className="page-title">Pengguna Tenant</h1>
        <div className="card">
          <p className="empty">Hanya owner/admin yang bisa mengelola pengguna.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="transactions-hero mb-24">
        <div>
          <div className="eyebrow">Pengaturan</div>
          <h1 className="page-title">Pengguna Tenant</h1>
          <p>Kelola siapa saja yang punya akses ke tenant ini.</p>
        </div>
        <div className="hero-actions">
          <button onClick={() => setShowForm(true)}>+ Tambah User</button>
        </div>
      </div>

      <div className="card">
        <div className="settings-users-list">
          {users.map((u) => (
            <div className="settings-user-item" key={u.id}>
              <div className="settings-user-main">
                <div className="recent-title">{u.name}</div>
                <div className="recent-meta">{u.whatsappNumber}</div>
              </div>
              <div className="settings-user-controls">
                <select value={u.role} onChange={(e) => changeRole(u, e.target.value)} disabled={!canChangeUser(u)}>
                  {managedRoles.includes(u.role) ? null : <option value={u.role}>{u.role}</option>}
                  {managedRoles.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
                <span className={'badge ' + u.status}>{u.status}</span>
              </div>
              <div className="transaction-actions">
                <button className="ghost small" onClick={() => toggle(u)} disabled={!canChangeUser(u)}>
                  {u.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
                <button className="danger small" onClick={() => remove(u)} disabled={!canChangeUser(u)}>
                  Hapus
                </button>
              </div>
            </div>
          ))}
          {users.length === 0 && <div className="empty">Belum ada user.</div>}
        </div>
      </div>

      {showForm && (
        <Modal
          title="Tambah User"
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button type="button" className="secondary" onClick={() => setShowForm(false)}>Batal</button>
              <button form="user-form" type="submit">Simpan</button>
            </>
          }
        >
          <form id="user-form" onSubmit={save}>
            <div className="field">
              <label>Nama</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>Nomor WhatsApp</label>
              <input value={form.whatsappNumber} onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })} required />
            </div>
            <div className="field">
              <label>Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {managedRoles.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
