import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';
import { api, setToken, shouldGoToSubscription } from '../lib/api.js';
import Modal from './Modal.jsx';

const navUser = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/transactions', label: 'Transaksi' },
  { to: '/transactions/new', label: '+ Tambah' },
  { to: '/accounts', label: 'Akun' },
  { to: '/debt', label: 'Hutang & Piutang' },
  { to: '/categories', label: 'Kategori' },
  { to: '/reports/cashflow', label: 'Laporan' },
];

const navSettings = [
  { to: '/settings/profile', label: 'Profil' },
  { to: '/settings/users', label: 'Pengguna', roles: ['owner', 'admin'] },
  { to: '/settings/subscription', label: 'Subscription' },
  { to: '/settings/whatsapp', label: 'WhatsApp' },
];

const navAdmin = [
  { to: '/admin/tenants', label: 'Tenants' },
  { to: '/admin/usage', label: 'Usage' },
];

const hasWhatsappBotPrivilege = (user) => {
  const plan = user?.tenant?.subscriptionPlan;
  return (plan === 'basic' || plan === 'pro') && !shouldGoToSubscription(user);
};

export default function AppLayout({ platformAdmin = false }) {
  const { user, tenants, logout, switchTenant } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showTenantForm, setShowTenantForm] = useState(false);
  const [showWhatsappPrompt, setShowWhatsappPrompt] = useState(false);
  const [savingTenant, setSavingTenant] = useState(false);
  const hasPersonalTenant = tenants?.some((t) => t.tenantType === 'personal');
  const [tenantForm, setTenantForm] = useState({ name: '', type: hasPersonalTenant ? 'umkm' : 'personal' });

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 900) setSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (platformAdmin || !user) return;

    const shouldPrompt =
      sessionStorage.getItem('catatin_show_whatsapp_prompt') === '1' &&
      hasWhatsappBotPrivilege(user) &&
      !user.whatsappLinked;

    if (shouldPrompt) setShowWhatsappPrompt(true);
    sessionStorage.removeItem('catatin_show_whatsapp_prompt');
  }, [platformAdmin, user]);

  const closeSidebar = () => setSidebarOpen(false);

  const openTenantForm = () => {
    setTenantForm({ name: '', type: hasPersonalTenant ? 'umkm' : 'personal' });
    setShowTenantForm(true);
  };

  const createTenant = async (e) => {
    e.preventDefault();
    setSavingTenant(true);
    try {
      const { data } = await api.post('/auth/tenants', tenantForm);
      setToken(data.token);
      toast.success('Tenant baru dibuat');
      window.location.href = '/dashboard';
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal membuat tenant');
    } finally {
      setSavingTenant(false);
    }
  };

  const openWhatsappSettings = () => {
    setShowWhatsappPrompt(false);
    navigate('/settings/whatsapp');
  };

  return (
    <div className="layout">
      <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle menu">
        <span></span><span></span><span></span>
      </button>

      {sidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar}></div>}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-name">CatatIN</div>
          <div className="brand-tagline">Pencatatan Keuangan Sederhana</div>
        </div>
        <nav style={{ flex: 1 }}>
          {platformAdmin ? (
            <>
              <div className="section">Admin Platform</div>
              {navAdmin.map((n) => (
                <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'active' : '')} onClick={closeSidebar}>
                  {n.label}
                </NavLink>
              ))}
            </>
          ) : (
            <>
              <div className="section">Menu</div>
              {navUser.map((n) => (
                <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'active' : '')} end onClick={closeSidebar}>
                  {n.label}
                </NavLink>
              ))}
              <div className="section">Pengaturan</div>
              {navSettings.filter((n) => !n.roles || n.roles.includes(user?.role)).map((n) => (
                <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'active' : '')} onClick={closeSidebar}>
                  {n.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div className="user-box">
          {!platformAdmin && tenants?.length > 1 && (
            <div className="field" style={{ marginBottom: 10 }}>
              <label style={{ color: '#cbd5e1' }}>Tenant aktif</label>
              <select value={user?.tenantId || ''} onChange={(e) => switchTenant(e.target.value)}>
                {tenants.map((t) => (
                  <option key={t.tenantId} value={t.tenantId}>{t.tenantName}</option>
                ))}
              </select>
            </div>
          )}
          {!platformAdmin && (
            <button type="button" className="secondary" style={{ marginBottom: 10, width: '100%' }} onClick={openTenantForm}>
              + Buat Tenant Baru
            </button>
          )}
          <div style={{ color: '#fff', fontWeight: 600 }}>{user?.name}</div>
          <div>{user?.whatsappNumber}</div>
          {user?.tenant && (
            <div className="muted" style={{ marginTop: 4 }}>
              {user.tenant.name}
              <div style={{ marginTop: 4, fontSize: 11 }}>
                Plan: {user.tenant.subscriptionPlan || '-'} · Status: {user.tenant.subscriptionStatus || '-'}
              </div>
            </div>
          )}
          <button
            className="secondary"
            style={{ marginTop: 10, width: '100%' }}
            onClick={logout}
          >
            Keluar
          </button>
        </div>
      </aside>

      <main>
        <Outlet />
      </main>

      {showTenantForm && (
        <Modal
          title="Buat Tenant Baru"
          onClose={() => setShowTenantForm(false)}
          footer={
            <>
              <button type="button" className="secondary" onClick={() => setShowTenantForm(false)}>Batal</button>
              <button form="tenant-self-form" type="submit" disabled={savingTenant}>{savingTenant ? 'Membuat...' : 'Buat Tenant'}</button>
            </>
          }
        >
          <form id="tenant-self-form" onSubmit={createTenant}>
            <div className="field">
              <label>Nama tenant</label>
              <input value={tenantForm.name} onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>Tipe tenant</label>
              <select value={tenantForm.type} onChange={(e) => setTenantForm({ ...tenantForm, type: e.target.value })}>
                <option value="personal" disabled={hasPersonalTenant}>Personal{hasPersonalTenant ? ' (sudah ada)' : ''}</option>
                <option value="umkm">UMKM</option>
              </select>
              {hasPersonalTenant && <div className="hint">Anda sudah memiliki tenant personal. Tenant tambahan harus bertipe UMKM.</div>}
            </div>
          </form>
        </Modal>
      )}

      {showWhatsappPrompt && (
        <Modal
          title="Aktifkan WhatsApp Bot"
          onClose={() => setShowWhatsappPrompt(false)}
          footer={
            <>
              <button type="button" className="secondary" onClick={() => setShowWhatsappPrompt(false)}>Nanti saja</button>
              <button type="button" onClick={openWhatsappSettings}>Hubungkan WhatsApp</button>
            </>
          }
        >
          <p style={{ marginTop: 0 }}>
            Plan Anda sudah mendukung WhatsApp Bot, tetapi nomor WhatsApp belum dihubungkan ke akun ini.
          </p>
          <p className="muted" style={{ marginBottom: 0 }}>
            Hubungkan nomor untuk mencatat transaksi, cek saldo, dan memakai bantuan pencatatan langsung dari chat WhatsApp.
          </p>
        </Modal>
      )}
    </div>
  );
}
