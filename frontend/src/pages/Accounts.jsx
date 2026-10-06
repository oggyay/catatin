import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../lib/api.js';
import { formatIDR, todayIsoDate } from '../lib/format.js';
import Modal from '../components/Modal.jsx';
import MoneyInput from '../components/MoneyInput.jsx';

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [deleteInfo, setDeleteInfo] = useState(null); // { account, totalTransactions, transferTransactions }
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({ name: '', type: 'cash', openingBalance: 0, isDefault: false });
  const [adjust, setAdjust] = useState({ realBalance: 0, reason: '', transactionDate: todayIsoDate() });

  const load = async () => {
    const { data } = await api.get('/accounts');
    // Filter: halaman Akun hanya tampilkan cash/bank/ewallet
    setAccounts(data.data.filter((a) => ['cash', 'bank', 'ewallet'].includes(a.type)));
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', type: 'cash', openingBalance: 0, isDefault: false });
    setShowForm(true);
  };
  const openEdit = (a) => {
    setEditing(a);
    setForm({ name: a.name, type: a.type, openingBalance: a.openingBalance, isDefault: a.isDefault });
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.patch(`/accounts/${editing.id}`, {
          name: form.name,
          type: form.type,
          isDefault: form.isDefault,
        });
        toast.success('Akun diperbarui');
      } else {
        await api.post('/accounts', form);
        toast.success('Akun ditambahkan');
      }
      setShowForm(false);
      load();
    } catch {}
  };

  const toggleStatus = async (a) => {
    try {
      await api.patch(`/accounts/${a.id}`, { status: a.status === 'active' ? 'inactive' : 'active' });
      load();
    } catch {}
  };

  const submitAdjust = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/accounts/${adjustTarget.id}/adjust-balance`, adjust);
      toast.success('Saldo disesuaikan');
      setAdjustTarget(null);
      load();
    } catch {}
  };

  const del = async (a) => {
    if (a.status === 'active') {
      if (!confirm(`Nonaktifkan akun "${a.name}"?`)) return;
      try {
        await api.delete(`/accounts/${a.id}`);
        toast.success('Akun dinonaktifkan');
        load();
      } catch {}
      return;
    }

    // akun inactive: ambil info dulu, tampilkan dialog konfirmasi
    try {
      const { data } = await api.get(`/accounts/${a.id}/delete-info`);
      setDeleteInfo({
        account: a,
        totalTransactions: data.data.totalTransactions,
        transferTransactions: data.data.transferTransactions,
      });
    } catch {}
  };

  const confirmHardDelete = async () => {
    if (!deleteInfo) return;
    setDeleting(true);
    try {
      await api.delete(`/accounts/${deleteInfo.account.id}`);
      toast.success('Akun dihapus permanen');
      setDeleteInfo(null);
      load();
    } catch {
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page accounts-page">
      <div className="transactions-hero mb-24">
        <div>
          <div className="eyebrow">Dompet & Rekening</div>
          <h1 className="page-title">Akun</h1>
          <p>Kelola semua sumber uang dalam satu tampilan yang lebih rapi.</p>
        </div>
        <div className="hero-actions">
          <button onClick={openNew}>+ Tambah Akun</button>
        </div>
      </div>

      <div className="accounts-grid">
        {accounts.map((a) => (
          <div className="card account-card" key={a.id}>
            <div className="account-card-top">
              <div>
                <div className="recent-title">{a.name}</div>
                <div className="recent-meta">{a.type} · {a.isDefault ? 'Akun default' : 'Akun tambahan'}</div>
              </div>
              <span className={'badge ' + a.status}>{a.status}</span>
            </div>
            <div className="account-balance">{formatIDR(a.currentBalance)}</div>
            <div className="account-card-foot">
              <span>{a.isDefault ? 'Dipakai default di WhatsApp' : 'Bukan default'}</span>
            </div>
            <div className="account-card-actions">
              <button className="secondary small" onClick={() => openEdit(a)}>Edit</button>
              <button className="secondary small" onClick={() => { setAdjustTarget(a); setAdjust({ realBalance: a.currentBalance, reason: '', transactionDate: todayIsoDate() }); }}>Sesuaikan</button>
              <button className="ghost small" onClick={() => toggleStatus(a)}>{a.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}</button>
              <button className="danger small" onClick={() => del(a)}>Hapus</button>
            </div>
          </div>
        ))}
        {accounts.length === 0 && <div className="card empty">Belum ada akun.</div>}
      </div>

      {showForm && (
        <Modal
          title={editing ? 'Edit Akun' : 'Tambah Akun'}
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button type="button" className="secondary" onClick={() => setShowForm(false)}>Batal</button>
              <button form="account-form" type="submit">Simpan</button>
            </>
          }
        >
          <form id="account-form" onSubmit={save}>
            <div className="field">
              <label>Nama</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>Tipe</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="ewallet">E-wallet</option>
              </select>
            </div>
            {!editing && (
              <div className="field">
                <label>Saldo Awal</label>
                <MoneyInput
                  value={form.openingBalance}
                  onChange={(val) => setForm({ ...form, openingBalance: val === '' ? 0 : val })}
                />
              </div>
            )}
            <div className="field">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" style={{ width: 16 }} checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
                Jadikan akun default untuk WhatsApp
              </label>
            </div>
          </form>
        </Modal>
      )}

      {adjustTarget && (
        <Modal
          title={`Sesuaikan Saldo ${adjustTarget.name}`}
          onClose={() => setAdjustTarget(null)}
          footer={
            <>
              <button type="button" className="secondary" onClick={() => setAdjustTarget(null)}>Batal</button>
              <button form="adjust-form" type="submit">Simpan</button>
            </>
          }
        >
          <form id="adjust-form" onSubmit={submitAdjust}>
            <div className="field">
              <label>Saldo sistem saat ini</label>
              <input value={formatIDR(adjustTarget.currentBalance)} disabled />
            </div>
            <div className="field">
              <label>Saldo Real (aktual)</label>
              <MoneyInput
                value={adjust.realBalance}
                onChange={(val) => setAdjust({ ...adjust, realBalance: val === '' ? 0 : val })}
              />
            </div>
            <div className="field">
              <label>Tanggal</label>
              <input type="date" value={adjust.transactionDate} onChange={(e) => setAdjust({ ...adjust, transactionDate: e.target.value })} required />
            </div>
            <div className="field">
              <label>Alasan</label>
              <textarea rows="2" value={adjust.reason} onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })} required />
            </div>
          </form>
        </Modal>
      )}
      {deleteInfo && (
        <Modal
          title="Hapus Akun Permanen"
          onClose={() => setDeleteInfo(null)}
          footer={
            <>
              <button type="button" className="secondary" onClick={() => setDeleteInfo(null)}>Batal</button>
              <button className="danger" onClick={confirmHardDelete} disabled={deleting}>
                {deleting ? 'Menghapus...' : 'Ya, Hapus Permanen'}
              </button>
            </>
          }
        >
          <p>Akun <strong>{deleteInfo.account.name}</strong> akan dihapus permanen.</p>
          {deleteInfo.totalTransactions > 0 ? (
            <p style={{ marginTop: 8 }}>
              {deleteInfo.totalTransactions} transaksi akan di-void
              {deleteInfo.transferTransactions > 0 && `, ${deleteInfo.transferTransactions} di antaranya adalah transfer ke akun lain`}.
              Saldo akun terkait akan disesuaikan otomatis.
            </p>
          ) : (
            <p style={{ marginTop: 8 }}>Akun ini tidak punya transaksi.</p>
          )}
          <p style={{ marginTop: 8, color: 'var(--color-danger, #e53e3e)' }}>Tindakan ini tidak dapat dibatalkan.</p>
        </Modal>
      )}
    </div>
  );
}
