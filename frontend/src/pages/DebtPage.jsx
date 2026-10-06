import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../lib/api.js';
import { formatIDR, todayIsoDate } from '../lib/format.js';
import Modal from '../components/Modal.jsx';
import MoneyInput from '../components/MoneyInput.jsx';

const EMPTY_TXN = { amount: 0, accountId: '', transactionDate: todayIsoDate(), description: '' };

export default function DebtPage() {
  const [tab, setTab] = useState('hutang');
  const [summary, setSummary] = useState({ totalHutang: 0, totalPiutang: 0 });
  const [debtAccount, setDebtAccount] = useState(null);   // akun Hutang
  const [piutangAccount, setPiutangAccount] = useState(null); // akun Piutang
  const [kasAccounts, setKasAccounts] = useState([]);     // cash/bank/ewallet
  const [txns, setTxns] = useState([]);                   // transaksi akun aktif
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('catat');    // 'catat' | 'bayar'
  const [form, setForm] = useState(EMPTY_TXN);

  const activeAccount = tab === 'hutang' ? debtAccount : piutangAccount;

  const load = async () => {
    const [debtRes, allRes] = await Promise.all([
      api.get('/accounts/debt-summary'),
      api.get('/accounts'),
    ]);
    const allAccounts = debtRes.data.data;
    setDebtAccount(allAccounts.find((a) => a.type === 'hutang') || null);
    setPiutangAccount(allAccounts.find((a) => a.type === 'piutang') || null);
    setSummary(debtRes.data.summary);
    setKasAccounts(allRes.data.data.filter((a) => ['cash', 'bank', 'ewallet'].includes(a.type) && a.status === 'active'));
  };

  const loadTxns = async (accountId) => {
    try {
      const { data } = await api.get(`/transactions?accountId=${accountId}&limit=30`);
      setTxns(data.data || []);
    } catch { setTxns([]); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (activeAccount) loadTxns(activeAccount.id);
  }, [tab, debtAccount, piutangAccount]);

  const openModal = (mode) => {
    setModalMode(mode);
    setForm({ ...EMPTY_TXN, accountId: kasAccounts[0]?.id || '' });
    setShowModal(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.accountId) { toast.error('Pilih akun kas/bank'); return; }
    if (!activeAccount) { toast.error('Akun tidak ditemukan'); return; }

    try {
      let fromId, toId, desc;

      if (tab === 'hutang') {
        if (modalMode === 'catat') {
          // Terima hutang: kas naik, hutang naik → transfer dari hutang ke kas
          fromId = activeAccount.id;
          toId = form.accountId;
          desc = form.description || 'Catat hutang baru';
        } else {
          // Bayar hutang: kas turun, hutang turun → transfer dari kas ke hutang
          fromId = form.accountId;
          toId = activeAccount.id;
          desc = form.description || 'Bayar hutang';
        }
      } else {
        if (modalMode === 'catat') {
          // Berikan piutang: kas turun, piutang naik → transfer dari kas ke piutang
          fromId = form.accountId;
          toId = activeAccount.id;
          desc = form.description || 'Catat piutang baru';
        } else {
          // Terima piutang: kas naik, piutang turun → transfer dari piutang ke kas
          fromId = activeAccount.id;
          toId = form.accountId;
          desc = form.description || 'Terima piutang';
        }
      }

      await api.post('/transactions/transfer', {
        fromAccountId: fromId,
        toAccountId: toId,
        amount: form.amount,
        transactionDate: form.transactionDate,
        description: desc,
      });

      toast.success('Berhasil dicatat');
      setShowModal(false);
      load();
      if (activeAccount) loadTxns(activeAccount.id);
    } catch {}
  };

  const tabLabel = tab === 'hutang' ? 'Hutang' : 'Piutang';
  const saldo = activeAccount ? Number(activeAccount.currentBalance) : 0;

  return (
    <div className="page accounts-page">
      <div className="transactions-hero mb-24">
        <div>
          <div className="eyebrow">Kewajiban & Tagihan</div>
          <h1 className="page-title">Hutang & Piutang</h1>
          <p>Pantau hutang dan piutang kamu.</p>
        </div>
      </div>

      {/* Summary */}
      <div className="accounts-grid" style={{ marginBottom: 24 }}>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div className="recent-meta">Total Hutang</div>
          <div className="account-balance" style={{ color: 'var(--color-danger, #e53e3e)' }}>
            {formatIDR(summary.totalHutang)}
          </div>
        </div>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div className="recent-meta">Total Piutang</div>
          <div className="account-balance" style={{ color: 'var(--color-success, #38a169)' }}>
            {formatIDR(summary.totalPiutang)}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['hutang', 'piutang'].map((t) => (
          <button key={t} className={tab === t ? '' : 'secondary'} onClick={() => setTab(t)}>
            {t === 'hutang' ? 'Hutang' : 'Piutang'}
          </button>
        ))}
      </div>

      {/* Saldo + aksi */}
      <div className="card" style={{ padding: '20px 24px', marginBottom: 20 }}>
        <div className="recent-meta">Saldo {tabLabel}</div>
        <div className="account-balance" style={{ color: tab === 'hutang' ? 'var(--color-danger, #e53e3e)' : 'var(--color-success, #38a169)', marginBottom: 16 }}>
          {formatIDR(saldo)}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => openModal('catat')}>
            + {tab === 'hutang' ? 'Catat Hutang' : 'Catat Piutang'}
          </button>
          {saldo > 0 && (
            <button className="secondary" onClick={() => openModal('bayar')}>
              {tab === 'hutang' ? 'Bayar Hutang' : 'Terima Piutang'}
            </button>
          )}
        </div>
      </div>

      {/* Riwayat transaksi */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div className="recent-title" style={{ marginBottom: 12 }}>Riwayat {tabLabel}</div>
        {txns.length === 0 ? (
          <p className="recent-meta">Belum ada transaksi.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {txns.map((t) => {
              const isIn = t.transferDirection === 'in';
              return (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--color-border, #eee)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{t.description || t.type}</div>
                    <div className="recent-meta">{new Date(t.transactionDate).toLocaleDateString('id-ID')}</div>
                  </div>
                  <div style={{ fontWeight: 600, color: isIn ? 'var(--color-success, #38a169)' : 'var(--color-danger, #e53e3e)' }}>
                    {isIn ? '+' : '-'}{formatIDR(t.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal catat / bayar */}
      {showModal && (
        <Modal
          title={
            tab === 'hutang'
              ? modalMode === 'catat' ? 'Catat Hutang Baru' : 'Bayar Hutang'
              : modalMode === 'catat' ? 'Catat Piutang Baru' : 'Terima Piutang'
          }
          onClose={() => setShowModal(false)}
          footer={
            <>
              <button type="button" className="secondary" onClick={() => setShowModal(false)}>Batal</button>
              <button form="debt-txn-form" type="submit">Simpan</button>
            </>
          }
        >
          <form id="debt-txn-form" onSubmit={submit}>
            <div className="field">
              <label>Nominal</label>
              <MoneyInput
                value={form.amount}
                onChange={(val) => setForm({ ...form, amount: val === '' ? 0 : val })}
              />
            </div>
            <div className="field">
              <label>
                {tab === 'hutang'
                  ? modalMode === 'catat' ? 'Masuk ke Akun' : 'Bayar dari Akun'
                  : modalMode === 'catat' ? 'Keluar dari Akun' : 'Masuk ke Akun'}
              </label>
              <select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} required>
                <option value="">-- Pilih akun --</option>
                {kasAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({formatIDR(a.currentBalance)})</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Tanggal</label>
              <input type="date" value={form.transactionDate} onChange={(e) => setForm({ ...form, transactionDate: e.target.value })} required />
            </div>
            <div className="field">
              <label>Keterangan</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Opsional — nama orang, keperluan, dll" />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
