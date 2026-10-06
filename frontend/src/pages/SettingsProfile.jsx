import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, setToken } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function SettingsProfile() {
  const { reloadUser, tenants, user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [tenant, setTenant] = useState(null);
  const hasOtherPersonalTenant = tenants?.some((t) => t.tenantType === 'personal' && t.tenantId !== user?.tenantId);

  useEffect(() => {
    (async () => {
      const [p, t] = await Promise.all([
        api.get('/settings/profile'),
        api.get('/settings/tenant'),
      ]);
      setProfile(p.data.data);
      setTenant(t.data.data);
    })();
  }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      await api.patch('/settings/profile', {
        name: profile.name,
        whatsappNumber: profile.whatsappNumber,
      });
      toast.success('Profil diperbarui');
      reloadUser();
    } catch {}
  };

  const saveTenant = async (e) => {
    e.preventDefault();
    try {
      await api.patch('/settings/tenant', { name: tenant.name, type: tenant.type });
      toast.success('Tenant diperbarui');
      reloadUser();
    } catch {}
  };

  const deleteTenant = async () => {
    if (!confirm(`Hapus tenant ${tenant.name}? Semua user dan transaksi tenant akan dinonaktifkan.`)) return;
    try {
      const { data } = await api.delete(`/auth/tenants/${tenant.id}`);
      setToken(data.token);
      toast.success('Tenant dihapus');
      window.location.href = '/dashboard';
    } catch (e) {
      toast.error(e.response?.data?.message || 'Gagal menghapus tenant');
    }
  };

  if (!profile || !tenant) return <div className="page">Memuat...</div>;

  return (
    <div className="page">
      <div className="transactions-hero mb-24">
        <div>
          <div className="eyebrow">Pengaturan</div>
          <h1 className="page-title">Profil & Tenant</h1>
          <p>Kelola data pribadi dan informasi bisnis Anda di sini.</p>
        </div>
      </div>

      <div className="grid cols-2 settings-grid">
        <div className="card">
          <div className="settings-card-head">
            <h3>Profil saya</h3>
            <p>Data pribadi yang dipakai untuk login dan WhatsApp bot.</p>
          </div>
          <form onSubmit={saveProfile}>
            <div className="field">
              <label>Nama</label>
              <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Nomor WhatsApp</label>
              <input value={profile.whatsappNumber} onChange={(e) => setProfile({ ...profile, whatsappNumber: e.target.value })} />
              <div className="hint">Nomor ini digunakan untuk login dan bot WhatsApp.</div>
            </div>
            <button type="submit">Simpan profil</button>
          </form>
        </div>

        <div className="card">
          <div className="settings-card-head">
            <h3>Tenant / Bisnis</h3>
            <p>Atur nama dan tipe tenant yang sedang Anda gunakan.</p>
          </div>
          <form onSubmit={saveTenant}>
            <div className="field">
              <label>Nama bisnis</label>
              <input value={tenant.name} onChange={(e) => setTenant({ ...tenant, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Tipe</label>
              <select value={tenant.type} onChange={(e) => setTenant({ ...tenant, type: e.target.value })}>
                <option value="personal" disabled={hasOtherPersonalTenant}>Personal{hasOtherPersonalTenant ? ' (sudah ada)' : ''}</option>
                <option value="umkm">UMKM</option>
              </select>
              {hasOtherPersonalTenant && (
                <div className="hint">Anda sudah memiliki tenant personal lain. Tenant ini tidak bisa diubah menjadi personal.</div>
              )}
            </div>
            <div className="field">
              <label>Paket aktif</label>
              <input value={`${tenant.subscriptionPlan} (${tenant.subscriptionStatus})`} disabled />
            </div>
            <div className="settings-actions">
              <button type="submit">Simpan tenant</button>
              {tenants?.length > 1 && user?.role === 'owner' && (
                <button type="button" className="danger" onClick={deleteTenant}>
                  Hapus tenant
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
