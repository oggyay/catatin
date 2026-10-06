import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api.js';
import Modal from '../components/Modal.jsx';

export default function AdminTenantDetail() {
  const { id } = useParams();
  const [tenant, setTenant] = useState(null);
  const [plan, setPlan] = useState('');
  const [subStatus, setSubStatus] = useState('');
  const [trialEndsAt, setTrialEndsAt] = useState('');
  const [showUserForm, setShowUserForm] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [userForm, setUserForm] = useState({ name: '', whatsappNumber: '', role: 'member' });

  const load = async () => {
    const { data } = await api.get(`/admin/tenants/${id}`);
    setTenant(data.data);
    setPlan(data.data.subscriptionPlan);
    setSubStatus(data.data.subscriptionStatus);
    setTrialEndsAt(data.data.trialEndsAt ? data.data.trialEndsAt.slice(0, 10) : '');
  };
  useEffect(() => { load(); }, [id]);

  const toggleStatus = async () => {
    try {
      await api.patch(`/admin/tenants/${id}/status`, {
        status: tenant.status === 'active' ? 'inactive' : 'active',
      });
      toast.success('Status diperbarui');
      load();
    } catch {}
  };

  const saveSubscription = async () => {
    try {
      await api.patch(`/admin/tenants/${id}/subscription`, {
        subscriptionPlan: plan,
        subscriptionStatus: subStatus,
        trialEndsAt: trialEndsAt ? new Date(`${trialEndsAt}T23:59:59`).toISOString() : null,
      });
      toast.success('Paket diperbarui');
      load();
    } catch {}
  };

  const toggleUserStatus = async (u) => {
    try {
      await api.patch(`/admin/tenants/${id}/users/${u.id}`, {
        status: u.status === 'active' ? 'inactive' : 'active',
      });
      toast.success('Status user diperbarui');
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Gagal mengubah status user');
    }
  };

  const deleteUser = async (u) => {
    if (!confirm(`Hapus user ${u.name}? Nomor WhatsApp akan bisa dipakai ulang.`)) return;
    try {
      await api.delete(`/admin/tenants/${id}/users/${u.id}`);
      toast.success('User dihapus');
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Gagal menghapus user');
    }
  };

  const changeUserRole = async (u, role) => {
    try {
      await api.patch(`/admin/tenants/${id}/users/${u.id}`, { role });
      toast.success('Role user diperbarui');
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Gagal mengubah role user');
    }
  };

  const resetWhatsapp = async (u) => {
    if (!confirm(`Reset koneksi WhatsApp ${u.name}?`)) return;
    try {
      await api.post(`/admin/tenants/${id}/users/${u.id}/reset-whatsapp`);
      toast.success('WhatsApp user direset');
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Gagal reset WhatsApp user');
    }
  };

  const deleteTenant = async () => {
    if (!confirm(`Hapus tenant ${tenant.name}? Semua user akan dinonaktifkan dan tenant tidak tampil lagi.`)) return;
    try {
      await api.delete(`/admin/tenants/${id}`);
      toast.success('Tenant dihapus');
      window.location.href = '/admin/tenants';
    } catch (e) {
      toast.error(e.response?.data?.message || 'Gagal menghapus tenant');
    }
  };

  const addUser = async (e) => {
    e.preventDefault();
    setSavingUser(true);
    try {
      await api.post(`/admin/tenants/${id}/users`, userForm);
      toast.success('User ditambahkan');
      setShowUserForm(false);
      setUserForm({ name: '', whatsappNumber: '', role: 'member' });
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Gagal menambah user');
    } finally {
      setSavingUser(false);
    }
  };

  if (!tenant) return <div className="page">Memuat...</div>;

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">{tenant.name}</h1>
        <Link to="/admin/tenants">← Kembali</Link>
      </div>

      <div className="grid cols-2 mb-16">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Info Tenant</h3>
          <p><b>Tipe:</b> {tenant.type === 'umkm' ? 'UMKM' : 'Personal'}</p>
          <p><b>Status:</b> <span className={'badge ' + tenant.status}>{tenant.status}</span></p>
          <p><b>Trial sampai:</b> {tenant.trialEndsAt ? tenant.trialEndsAt.slice(0, 10) : '-'}</p>
          <p><b>Pengguna:</b> {tenant._count?.users}</p>
          <p><b>Transaksi:</b> {tenant._count?.transactions}</p>
          <p><b>Akun:</b> {tenant._count?.accounts}</p>
          <p><b>WhatsApp Command:</b> {tenant.whatsappCommandCount}</p>
          <button className="secondary" onClick={toggleStatus}>
            {tenant.status === 'active' ? 'Nonaktifkan tenant' : 'Aktifkan tenant'}
          </button>
          <button className="danger" onClick={deleteTenant} style={{ marginLeft: 8 }}>
            Hapus tenant
          </button>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Subscription</h3>
          <div className="field">
            <label>Paket</label>
            <select value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="free">free</option>
              <option value="basic">basic</option>
              <option value="pro">pro</option>
            </select>
          </div>
          <div className="field">
            <label>Status</label>
            <select value={subStatus} onChange={(e) => setSubStatus(e.target.value)}>
              <option value="trial">trial</option>
              <option value="active">active</option>
              <option value="suspended">suspended</option>
              <option value="inactive">inactive</option>
            </select>
          </div>
          <div className="field">
            <label>Trial sampai</label>
            <input type="date" value={trialEndsAt} onChange={(e) => setTrialEndsAt(e.target.value)} />
          </div>
          <button onClick={saveSubscription}>Simpan</button>
        </div>
      </div>

      <div className="card">
        <div className="page-head mb-16">
          <h3 style={{ margin: 0 }}>Pengguna</h3>
          <button onClick={() => setShowUserForm(true)}>+ Tambah User</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nama</th><th>Nomor</th><th>WA Linked</th><th>Role</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {tenant.users?.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.whatsappNumber}</td>
                  <td>{u.whatsappJid ? 'Ya' : '-'}</td>
                  <td>
                    <select value={u.role} onChange={(e) => changeUserRole(u, e.target.value)}>
                      <option value="owner">owner</option>
                      <option value="admin">admin</option>
                      <option value="member">member</option>
                    </select>
                  </td>
                  <td><span className={'badge ' + u.status}>{u.status}</span></td>
                  <td>
                    <div className="table-actions">
                      <button className="ghost small" onClick={() => toggleUserStatus(u)}>
                        {u.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                      <button className="ghost small" onClick={() => resetWhatsapp(u)} disabled={!u.whatsappJid}>Reset WA</button>
                      <button className="ghost small" onClick={() => deleteUser(u)}>Hapus</button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!tenant.users || tenant.users.length === 0) && <tr><td colSpan="6" className="empty">Belum ada user.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showUserForm && (
        <Modal
          title="Tambah User Tenant"
          onClose={() => setShowUserForm(false)}
          footer={
            <>
              <button type="button" className="secondary" onClick={() => setShowUserForm(false)}>Batal</button>
              <button form="admin-user-form" type="submit" disabled={savingUser}>{savingUser ? 'Menyimpan...' : 'Simpan'}</button>
            </>
          }
        >
          <form id="admin-user-form" onSubmit={addUser}>
            <div className="field">
              <label>Nama</label>
              <input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>Nomor WhatsApp</label>
              <input value={userForm.whatsappNumber} onChange={(e) => setUserForm({ ...userForm, whatsappNumber: e.target.value })} required />
            </div>
            <div className="field">
              <label>Role</label>
              <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                <option value="owner">owner</option>
                <option value="admin">admin</option>
                <option value="member">member</option>
              </select>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
