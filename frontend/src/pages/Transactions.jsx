import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../lib/api.js';
import { formatIDR, formatDate } from '../lib/format.js';
import Modal from '../components/Modal.jsx';
import MoneyInput from '../components/MoneyInput.jsx';
import TransactionCreateModal from '../components/TransactionCreateModal.jsx';

function toInputDate(value) {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function Transactions() {
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    type: '',
    accountId: '',
    categoryId: '',
    source: '',
    status: '',
    dateFrom: '',
    dateTo: '',
    q: '',
  });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({
    amount: '',
    accountId: '',
    categoryId: '',
    transactionDate: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState({ fromAccountId: '', toAccountId: '', amount: '', description: '', transactionDate: '' });
  const [savingTransfer, setSavingTransfer] = useState(false);

  useEffect(() => {
    (async () => {
      const [a, c] = await Promise.all([api.get('/accounts'), api.get('/categories')]);
      setAccounts(a.data.data);
      setCategories(c.data.data);
    })();
  }, []);

  const load = useCallback(async () => {
    const params = { page, pageSize: 20 };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    const { data } = await api.get('/transactions', { params });
    setData(data.data);
    setPagination(data.pagination);
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);

  const doVoid = async (id) => {
    if (!confirm('Batalkan transaksi ini?')) return;
    try {
      await api.post(`/transactions/${id}/void`);
      toast.success('Transaksi dibatalkan');
      load();
    } catch {}
  };

  const updateFilter = (k) => (e) => {
    setPage(1);
    setFilters((f) => ({ ...f, [k]: e.target.value }));
  };

  const openEdit = (trx) => {
    setEditing(trx);
    setEditForm({
      amount: Number(trx.amount),
      accountId: trx.accountId,
      categoryId: trx.categoryId || '',
      transactionDate: toInputDate(trx.transactionDate),
    });
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editing) return;
    if (!editForm.amount || Number(editForm.amount) <= 0) {
      toast.error('Nominal harus lebih dari 0');
      return;
    }
    setSavingEdit(true);
    try {
      await api.patch(`/transactions/${editing.id}`, {
        amount: editForm.amount,
        accountId: editForm.accountId,
        categoryId: editForm.categoryId || null,
        transactionDate: editForm.transactionDate,
      });
      toast.success('Transaksi diperbarui');
      setEditing(null);
      await load();
    } catch {
    } finally {
      setSavingEdit(false);
    }
  };

  const editCategories = categories.filter((c) => c.type === editing?.type && c.status === 'active');
  const activeAccounts = accounts.filter((a) => a.status === 'active');
  const hasActiveFilters = Object.values(filters).some(Boolean);
  const displayData = [];
  const transferGroups = new Set();
  for (const t of data) {
    if (!t.transferGroupId) {
      displayData.push({ kind: 'transaction', transaction: t });
      continue;
    }
    if (transferGroups.has(t.transferGroupId)) continue;
    const pair = data.filter((x) => x.transferGroupId === t.transferGroupId);
    const out = pair.find((x) => x.transferDirection === 'out') || pair.find((x) => x.type === 'expense');
    const incoming = pair.find((x) => x.transferDirection === 'in') || pair.find((x) => x.type === 'income');
    transferGroups.add(t.transferGroupId);
    displayData.push({ kind: 'transfer', id: t.transferGroupId, out, incoming, transaction: out || incoming || t });
  }
  displayData.sort((a, b) => {
    const ad = a.transaction?.transactionDate ? String(a.transaction.transactionDate).slice(0, 10) : '';
    const bd = b.transaction?.transactionDate ? String(b.transaction.transactionDate).slice(0, 10) : '';
    const at = ad ? new Date(`${ad}T00:00:00`).getTime() : 0;
    const bt = bd ? new Date(`${bd}T00:00:00`).getTime() : 0;
    if (bt !== at) return bt - at;
    const ac = new Date(a.transaction?.createdAt || 0).getTime();
    const bc = new Date(b.transaction?.createdAt || 0).getTime();
    return bc - ac;
  });

  const resetFilters = () => {
    setPage(1);
    setFilters({ type: '', accountId: '', categoryId: '', source: '', status: '', dateFrom: '', dateTo: '', q: '' });
  };

  const saveTransfer = async (e) => {
    e.preventDefault();
    if (transferForm.fromAccountId === transferForm.toAccountId) {
      toast.error('Akun asal dan tujuan tidak boleh sama');
      return;
    }
    setSavingTransfer(true);
    try {
      await api.post('/transactions/transfer', {
        fromAccountId: transferForm.fromAccountId,
        toAccountId: transferForm.toAccountId,
        amount: transferForm.amount,
        description: transferForm.description || null,
        transactionDate: transferForm.transactionDate || undefined,
      });
      toast.success('Transfer berhasil disimpan');
      setShowTransfer(false);
      setTransferForm({ fromAccountId: '', toAccountId: '', amount: '', description: '', transactionDate: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan transfer');
    } finally {
      setSavingTransfer(false);
    }
  };

  return (
    <div className="page transactions-page">
      <div className="transactions-hero mb-24">
        <div>
          <div className="eyebrow">Riwayat Keuangan</div>
          <h1 className="page-title">Transaksi</h1>
          <p>Lihat, cari, dan rapikan semua transaksi tanpa harus buka layar yang membingungkan.</p>
        </div>
        <div className="hero-actions">
          <button className="secondary" onClick={load}>↻ Refresh</button>
          <button className="secondary" onClick={() => setShowTransfer(true)}>↔ Transfer</button>
          <button onClick={() => setShowCreate(true)}>+ Tambah</button>
        </div>
      </div>

      <div className="card transactions-shell">
        <div className="transactions-toolbar">
          <div>
            <h2>Filter transaksi</h2>
            <p>Persempit hasil berdasarkan tipe, akun, kategori, sumber, dan waktu.</p>
          </div>
          <div className="transactions-toolbar-actions">
            <button className="secondary" onClick={() => setShowTransfer(true)}>Transfer Antar Akun</button>
            {hasActiveFilters && <button className="secondary" onClick={resetFilters}>Reset filter</button>}
          </div>
        </div>

        <div className="filters filters-rich">
          <div className="field">
            <label>Tipe</label>
            <select value={filters.type} onChange={updateFilter('type')}>
              <option value="">Semua</option>
              <option value="income">Pemasukan</option>
              <option value="expense">Pengeluaran</option>
              <option value="adjustment">Penyesuaian</option>
            </select>
          </div>
          <div className="field">
            <label>Akun</label>
            <select value={filters.accountId} onChange={updateFilter('accountId')}>
              <option value="">Semua</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Kategori</label>
            <select value={filters.categoryId} onChange={updateFilter('categoryId')}>
              <option value="">Semua</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
            </select>
          </div>
          <div className="field">
            <label>Sumber</label>
            <select value={filters.source} onChange={updateFilter('source')}>
              <option value="">Semua</option>
              <option value="web">Web</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="adjustment">Penyesuaian</option>
            </select>
          </div>
          <div className="field">
            <label>Status</label>
            <select value={filters.status} onChange={updateFilter('status')}>
              <option value="">Semua</option>
              <option value="active">Aktif</option>
              <option value="void">Void</option>
            </select>
          </div>
          <div className="field">
            <label>Dari</label>
            <input type="date" value={filters.dateFrom} onChange={updateFilter('dateFrom')} />
          </div>
          <div className="field">
            <label>Sampai</label>
            <input type="date" value={filters.dateTo} onChange={updateFilter('dateTo')} />
          </div>
          <div className="field">
            <label>Cari keterangan</label>
            <input value={filters.q} onChange={updateFilter('q')} placeholder="makan siang..." />
          </div>
        </div>

        <div className="transactions-list">
          {displayData.map((item) => {
            const t = item.transaction;
            const isTransfer = item.kind === 'transfer';
            const title = isTransfer
              ? `Transfer ${item.out?.account?.name || '-'} -> ${item.incoming?.account?.name || '-'}`
              : (t.description || 'Tanpa keterangan');
            const description = isTransfer
              ? (t.description || '').replace(/^\[Transfer (Keluar|Masuk)\]\s*/i, '')
              : `${formatDate(t.transactionDate)} · ${t.account?.name} · ${t.category?.name || 'Tanpa kategori'}`;

            return (
            <div className="transaction-item" key={isTransfer ? item.id : t.id}>
              <div className="transaction-main">
                <div className={`recent-icon ${isTransfer ? 'adjustment' : t.type}`}>{isTransfer ? '↔' : t.type === 'income' ? '+' : t.type === 'expense' ? '-' : '±'}</div>
                <div>
                  <div className="recent-title">{title}</div>
                  <div className="recent-meta">{isTransfer ? `${formatDate(t.transactionDate)} · ${description || 'Transfer antar akun'}` : description}</div>
                  <div className="transaction-badges">
                    <span className={'badge ' + (isTransfer ? 'adjustment' : t.type)}>{isTransfer ? 'transfer' : t.type}</span>
                    <span className={'badge ' + t.source}>{t.source}</span>
                    <span className={'badge ' + t.status}>{t.status}</span>
                  </div>
                </div>
              </div>
              <div className="transaction-side">
                <div className={`recent-amount ${isTransfer ? '' : t.type === 'income' ? 'pos' : t.type === 'expense' ? 'neg' : ''}`}>{formatIDR(t.amount)}</div>
                {t.status === 'active' && t.type !== 'adjustment' && (
                  <div className="transaction-actions">
                    {!isTransfer && <button className="secondary small" onClick={() => openEdit(t)}>Edit</button>}
                    <button className="ghost small" onClick={() => doVoid(t.id)}>Void</button>
                  </div>
                )}
              </div>
            </div>
          );
          })}
          {displayData.length === 0 && <div className="empty">Tidak ada transaksi sesuai filter.</div>}
        </div>

        <div className="pagination">
          <span className="muted">Halaman {pagination.page} dari {pagination.totalPages} ({pagination.total} transaksi)</span>
          <button className="secondary small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Sebelumnya</button>
          <button className="secondary small" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>Berikutnya</button>
        </div>
      </div>

      {editing && (
        <Modal
          title="Edit Transaksi"
          onClose={() => setEditing(null)}
          footer={
            <>
              <button type="button" className="secondary" onClick={() => setEditing(null)}>
                Batal
              </button>
              <button form="edit-transaction-form" type="submit" disabled={savingEdit}>
                {savingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </>
          }
        >
          <form id="edit-transaction-form" onSubmit={saveEdit}>
            <div className="field">
              <label>Tipe</label>
              <input value={editing.type === 'income' ? 'Pemasukan' : 'Pengeluaran'} disabled />
              <div className="hint">Tipe transaksi tidak diubah dari form edit.</div>
            </div>
            <div className="field">
              <label>Nominal</label>
              <MoneyInput
                value={editForm.amount}
                onChange={(val) => setEditForm((f) => ({ ...f, amount: val }))}
              />
            </div>
            <div className="field">
              <label>Tanggal</label>
              <input
                type="date"
                value={editForm.transactionDate}
                onChange={(e) => setEditForm((f) => ({ ...f, transactionDate: e.target.value }))}
                required
              />
            </div>
            <div className="field">
              <label>Akun</label>
              <select
                value={editForm.accountId}
                onChange={(e) => setEditForm((f) => ({ ...f, accountId: e.target.value }))}
                required
              >
                <option value="">Pilih akun</option>
                {accounts.filter((a) => a.status === 'active').map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Kategori</label>
              <select
                value={editForm.categoryId}
                onChange={(e) => setEditForm((f) => ({ ...f, categoryId: e.target.value }))}
              >
                <option value="">Tanpa kategori</option>
                {editCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </form>
        </Modal>
      )}

      {showTransfer && (
        <Modal
          title="Transfer Antar Akun"
          onClose={() => setShowTransfer(false)}
          footer={
            <>
              <button type="button" className="secondary" onClick={() => setShowTransfer(false)}>Batal</button>
              <button form="transfer-form" type="submit" disabled={savingTransfer}>{savingTransfer ? 'Menyimpan...' : 'Simpan Transfer'}</button>
            </>
          }
        >
          <form id="transfer-form" onSubmit={saveTransfer}>
            <div className="form-grid-2">
              <div className="field">
                <label>Dari akun</label>
                <select
                  value={transferForm.fromAccountId}
                  onChange={(e) => setTransferForm((f) => ({
                    ...f,
                    fromAccountId: e.target.value,
                    toAccountId: f.toAccountId === e.target.value ? '' : f.toAccountId,
                  }))}
                  required
                >
                  <option value="">Pilih akun asal</option>
                  {activeAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Ke akun</label>
                <select value={transferForm.toAccountId} onChange={(e) => setTransferForm((f) => ({ ...f, toAccountId: e.target.value }))} required>
                  <option value="">Pilih akun tujuan</option>
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id} disabled={a.id === transferForm.fromAccountId}>
                      {a.name}
                    </option>
                  ))}
                </select>
                {transferForm.fromAccountId && transferForm.toAccountId === transferForm.fromAccountId && (
                  <div className="hint neg">Akun tujuan tidak boleh sama dengan akun asal.</div>
                )}
              </div>
            </div>
            <div className="field amount-field">
              <label>Nominal</label>
              <MoneyInput value={transferForm.amount} onChange={(val) => setTransferForm((f) => ({ ...f, amount: val }))} />
            </div>
            <div className="field">
              <label>Tanggal</label>
              <input type="date" value={transferForm.transactionDate} onChange={(e) => setTransferForm((f) => ({ ...f, transactionDate: e.target.value }))} />
            </div>
            <div className="field">
              <label>Keterangan</label>
              <textarea rows="2" value={transferForm.description} onChange={(e) => setTransferForm((f) => ({ ...f, description: e.target.value }))} placeholder="Contoh: tarik tunai" />
            </div>
          </form>
        </Modal>
      )}

      <TransactionCreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={load}
      />
    </div>
  );
}
