import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { formatIDR, formatDate } from '../lib/format.js';
import TransactionCreateModal from '../components/TransactionCreateModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const PERIODS = [
  { value: 'today', label: 'Hari ini' },
  { value: 'this_week', label: 'Minggu ini' },
  { value: 'this_month', label: 'Bulan ini' },
];

function ProgressBar({ value, max, tone = 'primary' }) {
  const pct = max > 0 ? Math.max(4, Math.min(100, (Number(value || 0) / max) * 100)) : 0;
  return (
    <div className="dash-bar-track">
      <div className={`dash-bar-fill ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function MiniStat({ label, value, tone }) {
  return (
    <div className="mini-stat">
      <span>{label}</span>
      <strong className={tone || ''}>{value}</strong>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [report, setReport] = useState(null);
  const [period, setPeriod] = useState('this_month');
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const isUmkm = user?.tenant?.type === 'umkm';
  const copy = isUmkm
    ? {
        heroTitle: 'Ringkasan Keuangan Usaha',
        heroDesc: 'Pantau kas usaha, omzet, biaya, akun aktif, dan transaksi terbaru dalam satu tempat.',
        totalBalance: 'Total Kas Usaha',
        income: 'Omzet Periode Ini',
        expense: 'Biaya Periode Ini',
        net: 'Laba Bersih',
        cashflow: 'Arus Kas Usaha',
        incomeMeter: 'Omzet',
        expenseMeter: 'Biaya',
        topIncome: 'Kategori omzet terbesar',
        topExpense: 'Kategori biaya terbesar',
        quickDesc: 'Shortcut untuk operasional usaha.',
        addTransaction: '+ Tambah Transaksi Usaha',
        addTransactionHint: 'Catat penjualan atau biaya usaha',
        accounts: 'Akun Usaha',
        accountsHint: 'Kas, rekening usaha, dan e-wallet',
        categoriesHint: 'Rapikan klasifikasi omzet dan biaya',
        accountSection: 'Akun Usaha Aktif',
        topCategory: 'Top Kategori Usaha',
        recent: 'Transaksi Usaha Terbaru',
        empty: 'Belum ada transaksi usaha. Mulai dengan menekan tombol + Tambah.',
      }
    : {
        heroTitle: 'Ringkasan Keuangan Pribadi',
        heroDesc: 'Pantau saldo, arus kas, akun aktif, dan transaksi terbaru dalam satu tempat.',
        totalBalance: 'Total Saldo',
        income: 'Pemasukan Periode Ini',
        expense: 'Pengeluaran Periode Ini',
        net: 'Sisa Arus Kas',
        cashflow: 'Arus Kas',
        incomeMeter: 'Pemasukan',
        expenseMeter: 'Pengeluaran',
        topIncome: 'Kategori pemasukan terbesar',
        topExpense: 'Kategori pengeluaran terbesar',
        quickDesc: 'Shortcut untuk aktivitas harian.',
        addTransaction: '+ Tambah Transaksi',
        addTransactionHint: 'Catat pemasukan atau pengeluaran',
        accounts: 'Kelola Akun',
        accountsHint: 'Kas, bank, dan e-wallet',
        categoriesHint: 'Rapikan klasifikasi transaksi',
        accountSection: 'Akun Aktif',
        topCategory: 'Top Kategori',
        recent: 'Transaksi Terbaru',
        empty: 'Belum ada transaksi. Mulai dengan menekan tombol + Tambah.',
      };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r, a, cashflow] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/dashboard/recent-transactions', { params: { limit: 8 } }),
        api.get('/accounts'),
        api.get('/reports/cashflow', { params: { period } }),
      ]);
      setSummary(s.data.data);
      setRecent(r.data.data);
      setAccounts(a.data.data);
      setReport(cashflow.data.data);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const activeAccounts = accounts.filter((a) => a.status === 'active');
  const selectedAccount = selectedAccountId === 'all'
    ? null
    : activeAccounts.find((a) => a.id === selectedAccountId);

  const filteredRecent = selectedAccount
    ? recent.filter((t) => t.account?.id === selectedAccount.id)
    : recent;

  const biggestExpense = report?.expenseByCategory?.[0];
  const biggestIncome = report?.incomeByCategory?.[0];
  const topExpenseMax = Math.max(...(report?.expenseByCategory || []).map((x) => Number(x.total)), 0);
  const topIncomeMax = Math.max(...(report?.incomeByCategory || []).map((x) => Number(x.total)), 0);

  const cashflowHealth = useMemo(() => {
    if (!report) return { label: 'Memuat', tone: '' };
    if (report.netCashflow > 0) return { label: 'Surplus', tone: 'pos' };
    if (report.netCashflow < 0) return { label: 'Defisit', tone: 'neg' };
    return { label: 'Seimbang', tone: '' };
  }, [report]);

  return (
    <div className="page dashboard-page">
      <div className="dashboard-hero">
        <div>
          <div className="eyebrow">{isUmkm ? 'Dashboard Usaha' : 'Dashboard Pribadi'}</div>
          <h1>Halo, {user?.name?.split(' ')[0] || 'Sahabat'} 👋</h1>
          <p>{copy.heroDesc}</p>
        </div>
        <div className="hero-actions">
          <button className="secondary" onClick={load} disabled={loading}>
            {loading ? 'Memuat...' : '↻ Refresh'}
          </button>
          <button onClick={() => setShowCreate(true)}>{copy.addTransaction}</button>
        </div>
      </div>

      <div className="dash-toolbar">
        <div className="period-switcher">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              className={period === p.value ? 'active' : ''}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)}>
          <option value="all">Semua akun</option>
          {activeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {!user?.whatsappLinked && (
        <div className="whatsapp-bind-banner mb-16">
          <div>
            <strong>WhatsApp belum terhubung</strong>
            <span>Hubungkan WhatsApp agar bisa cek saldo dan catat transaksi langsung dari chat.</span>
          </div>
          <Link to="/settings/whatsapp"><button className="secondary">Hubungkan WhatsApp</button></Link>
        </div>
      )}

      <div className="grid cols-4 mb-24">
        <div className="kpi interactive-kpi">
          <div className="label">{copy.totalBalance}</div>
          <div className="value">{summary ? formatIDR(summary.totalBalance) : '...'}</div>
          <div className="kpi-foot">{activeAccounts.length} akun aktif</div>
        </div>
        <div className="kpi interactive-kpi">
          <div className="label">{copy.income}</div>
          <div className="value pos">{report ? formatIDR(report.totalIncome) : '...'}</div>
          <div className="kpi-foot">{report?.incomeCount || 0} transaksi</div>
        </div>
        <div className="kpi interactive-kpi">
          <div className="label">{copy.expense}</div>
          <div className="value neg">{report ? formatIDR(report.totalExpense) : '...'}</div>
          <div className="kpi-foot">{report?.expenseCount || 0} transaksi</div>
        </div>
        <div className="kpi interactive-kpi">
          <div className="label">{copy.net}</div>
          <div className={`value ${cashflowHealth.tone}`}>{report ? formatIDR(report.netCashflow) : '...'}</div>
          <div className={`kpi-foot ${cashflowHealth.tone}`}>{cashflowHealth.label}</div>
        </div>
      </div>

      <div className="dashboard-grid mb-24">
        <div className="card cashflow-card">
          <div className="section-head">
            <div>
              <h2>{copy.cashflow}</h2>
              <p>{report?.range?.label || 'Periode terpilih'}</p>
            </div>
            <Link to="/reports/cashflow">Detail laporan</Link>
          </div>

          <div className="cashflow-meter">
            <div className="meter-row income">
              <span>{copy.incomeMeter}</span>
              <strong>{formatIDR(report?.totalIncome || 0)}</strong>
            </div>
            <ProgressBar value={report?.totalIncome || 0} max={Math.max(report?.totalIncome || 0, report?.totalExpense || 0)} tone="income" />
            <div className="meter-row expense">
              <span>{copy.expenseMeter}</span>
              <strong>{formatIDR(report?.totalExpense || 0)}</strong>
            </div>
            <ProgressBar value={report?.totalExpense || 0} max={Math.max(report?.totalIncome || 0, report?.totalExpense || 0)} tone="expense" />
          </div>

          <div className="quick-insights">
            <MiniStat label={copy.topIncome} value={biggestIncome ? biggestIncome.name : '-'} tone="pos" />
            <MiniStat label={copy.topExpense} value={biggestExpense ? biggestExpense.name : '-'} tone="neg" />
          </div>
        </div>

        <div className="card quick-card">
          <div className="section-head">
            <div>
              <h2>Aksi Cepat</h2>
              <p>{copy.quickDesc}</p>
            </div>
          </div>
          <div className="quick-action-list">
            <button type="button" className="quick-action primary-action" onClick={() => setShowCreate(true)}>
              <span>{copy.addTransaction}</span>
              <small>{copy.addTransactionHint}</small>
            </button>
            <Link to="/accounts" className="quick-action">
              <span>{copy.accounts}</span>
              <small>{copy.accountsHint}</small>
            </Link>
            <Link to="/categories" className="quick-action">
              <span>Kelola Kategori</span>
              <small>{copy.categoriesHint}</small>
            </Link>
            <Link to="/settings/whatsapp" className="quick-action">
              <span>Command WhatsApp</span>
              <small>Lihat contoh input cepat</small>
            </Link>
          </div>
        </div>
      </div>

      <div className="dashboard-grid mb-24">
        <div className="card">
          <div className="section-head">
            <div>
              <h2>{copy.accountSection}</h2>
              <p>Klik akun untuk memfilter transaksi terbaru.</p>
            </div>
            <Link to="/accounts">Kelola</Link>
          </div>
          <div className="account-strip">
            <button
              className={`account-chip ${selectedAccountId === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedAccountId('all')}
            >
              <span>Semua Akun</span>
              <strong>{formatIDR(summary?.totalBalance || 0)}</strong>
            </button>
            {activeAccounts.map((a) => (
              <button
                key={a.id}
                className={`account-chip ${selectedAccountId === a.id ? 'active' : ''}`}
                onClick={() => setSelectedAccountId(a.id)}
              >
                <span>{a.name}</span>
                <strong>{formatIDR(a.currentBalance)}</strong>
                <small>{a.type}{a.isDefault ? ' · default' : ''}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="section-head">
            <div>
              <h2>{copy.topCategory}</h2>
              <p>Breakdown periode terpilih.</p>
            </div>
          </div>
          <div className="category-bars">
            <h3>{copy.expenseMeter}</h3>
            {(report?.expenseByCategory || []).slice(0, 4).map((c) => (
              <div key={c.categoryId || c.name} className="category-bar-row">
                <div><span>{c.name}</span><strong>{formatIDR(c.total)}</strong></div>
                <ProgressBar value={c.total} max={topExpenseMax} tone="expense" />
              </div>
            ))}
            {(report?.expenseByCategory || []).length === 0 && <div className="muted">Belum ada {copy.expenseMeter.toLowerCase()}.</div>}

            <h3 style={{ marginTop: 18 }}>{copy.incomeMeter}</h3>
            {(report?.incomeByCategory || []).slice(0, 4).map((c) => (
              <div key={c.categoryId || c.name} className="category-bar-row">
                <div><span>{c.name}</span><strong>{formatIDR(c.total)}</strong></div>
                <ProgressBar value={c.total} max={topIncomeMax} tone="income" />
              </div>
            ))}
            {(report?.incomeByCategory || []).length === 0 && <div className="muted">Belum ada {copy.incomeMeter.toLowerCase()}.</div>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="section-head">
          <div>
              <h2>{copy.recent}</h2>
            <p>{selectedAccount ? `Difilter: ${selectedAccount.name}` : 'Semua akun'}</p>
          </div>
          <Link to="/transactions">Lihat semua</Link>
        </div>
        {filteredRecent.length === 0 ? (
          <div className="empty">{copy.empty}</div>
        ) : (
          <div className="recent-list">
            {filteredRecent.map((t) => (
              <div key={t.id} className="recent-item">
                <div className="recent-main">
                  <div className={`recent-icon ${t.type}`}>{t.type === 'income' ? '+' : t.type === 'expense' ? '-' : '±'}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="recent-title">{t.category?.name || 'Tanpa kategori'} · {t.account?.name || '-'}</div>
                    <div className="recent-meta">{formatDate(t.transactionDate)}{t.description ? ` · ${t.description}` : ''}</div>
                  </div>
                </div>
                <div className={`recent-amount ${t.type === 'income' ? 'pos' : t.type === 'expense' ? 'neg' : ''}`}>
                  {formatIDR(t.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <TransactionCreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={load}
      />
    </div>
  );
}
