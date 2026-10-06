import { useCallback, useEffect, useState } from 'react';
import { api, getToken } from '../lib/api.js';
import { formatIDR } from '../lib/format.js';

export default function CashflowReport() {
  const [period, setPeriod] = useState('this_month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    const params = {};
    if (dateFrom && dateTo) { params.dateFrom = dateFrom; params.dateTo = dateTo; }
    else params.period = period;
    const { data } = await api.get('/reports/cashflow', { params });
    setData(data.data);
  }, [period, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const exportXlsx = async () => {
    const params = new URLSearchParams();
    if (dateFrom && dateTo) { params.set('dateFrom', dateFrom); params.set('dateTo', dateTo); }
    else params.set('period', period);
    const url = `/api/reports/cashflow/export?${params.toString()}`;
    const token = getToken();
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { alert('Gagal export'); return; }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cashflow-${Date.now()}.xlsx`;
    a.click();
  };

  return (
    <div className="page report-page">
      <div className="transactions-hero mb-24">
        <div>
          <div className="eyebrow">Analisis</div>
          <h1 className="page-title">Laporan Cashflow</h1>
          <p>Ringkasan arus kas berdasarkan periode, kategori, dan akun.</p>
        </div>
        <div className="hero-actions">
          <button onClick={exportXlsx}>Export Excel</button>
        </div>
      </div>

      <div className="card mb-16">
        <div className="report-filters">
          <div className="field">
            <label>Periode</label>
            <select value={period} onChange={(e) => { setPeriod(e.target.value); setDateFrom(''); setDateTo(''); }}>
              <option value="today">Hari ini</option>
              <option value="this_week">Minggu ini</option>
              <option value="this_month">Bulan ini</option>
            </select>
          </div>
          <div className="field">
            <label>Custom dari</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="field">
            <label>Custom sampai</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
      </div>

      {!data ? (
        <div className="card"><div className="empty">Memuat...</div></div>
      ) : (
        <>
          <div className="grid cols-3 mb-16">
            <div className="kpi interactive-kpi"><div className="label">Pemasukan</div><div className="value pos">{formatIDR(data.totalIncome)}</div></div>
            <div className="kpi interactive-kpi"><div className="label">Pengeluaran</div><div className="value neg">{formatIDR(data.totalExpense)}</div></div>
            <div className="kpi interactive-kpi"><div className="label">Net Cashflow</div><div className={'value ' + (data.netCashflow >= 0 ? 'pos' : 'neg')}>{formatIDR(data.netCashflow)}</div></div>
          </div>

          <div className="grid cols-2 mb-16">
            <div className="card">
              <h3 className="report-section-title">Pemasukan per Kategori</h3>
              <div className="report-list">
                {data.incomeByCategory.map((c) => (
                  <div className="report-row" key={c.categoryId || 'uncat'}>
                    <div className="report-row-main">
                      <span className="recent-title">{c.name}</span>
                      <span className="recent-meta">{c.count} transaksi</span>
                    </div>
                    <span className="recent-amount pos">{formatIDR(c.total)}</span>
                  </div>
                ))}
                {data.incomeByCategory.length === 0 && <div className="empty">Tidak ada pemasukan.</div>}
              </div>
            </div>
            <div className="card">
              <h3 className="report-section-title">Pengeluaran per Kategori</h3>
              <div className="report-list">
                {data.expenseByCategory.map((c) => (
                  <div className="report-row" key={c.categoryId || 'uncat'}>
                    <div className="report-row-main">
                      <span className="recent-title">{c.name}</span>
                      <span className="recent-meta">{c.count} transaksi</span>
                    </div>
                    <span className="recent-amount neg">{formatIDR(c.total)}</span>
                  </div>
                ))}
                {data.expenseByCategory.length === 0 && <div className="empty">Tidak ada pengeluaran.</div>}
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="report-section-title">Per Akun</h3>
            <div className="report-list">
              {data.perAccount.map((a) => (
                <div className="report-row report-row-account" key={a.accountId}>
                  <div className="report-row-main">
                    <span className="recent-title">{a.name}</span>
                    <span className="recent-meta">{a.type}</span>
                  </div>
                  <div className="report-row-numbers">
                    <span className="pos">{formatIDR(a.income)}</span>
                    <span className="neg">{formatIDR(a.expense)}</span>
                    <span className={a.net >= 0 ? 'pos' : 'neg'}>{formatIDR(a.net)}</span>
                    <span>{formatIDR(a.currentBalance)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
