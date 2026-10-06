import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../lib/api.js';
import { todayIsoDate } from '../lib/format.js';
import MoneyInput from './MoneyInput.jsx';

export default function TransactionForm({ onSuccess, onCancel, compact = false }) {
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [type, setType] = useState('expense');
  const [form, setForm] = useState({
    amount: '',
    accountId: '',
    categoryId: '',
    transactionDate: todayIsoDate(),
    description: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [a, c] = await Promise.all([
        api.get('/accounts'),
        api.get('/categories'),
      ]);
      setAccounts(a.data.data);
      setCategories(c.data.data);
      const def = a.data.data.find((x) => x.isDefault && x.status === 'active') || a.data.data[0];
      if (def) setForm((f) => ({ ...f, accountId: def.id }));
    })();
  }, []);

  const catOptions = categories.filter((c) => c.type === type && c.status === 'active');
  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error('Nominal harus lebih dari 0');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        type,
        amount: form.amount,
        accountId: form.accountId,
        categoryId: form.categoryId || null,
        transactionDate: form.transactionDate,
        description: form.description || null,
      };

      const { data } = await api.post('/transactions', payload);
      toast.success('Transaksi berhasil disimpan');
      onSuccess?.(data.data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className={compact ? 'transaction-form compact' : 'transaction-form'}>
      <div className="type-toggle">
        <button
          type="button"
          className={type === 'expense' ? 'active-expense' : ''}
          onClick={() => setType('expense')}
        >
          Pengeluaran
        </button>
        <button
          type="button"
          className={type === 'income' ? 'active-income' : ''}
          onClick={() => setType('income')}
        >
          Pemasukan
        </button>
      </div>

      <div className="field amount-field">
        <label>Nominal</label>
        <MoneyInput
          size="lg"
          value={form.amount}
          onChange={(val) => setForm((f) => ({ ...f, amount: val }))}
          autoFocus
        />
      </div>

      <div className="form-grid-2">
        <div className="field">
          <label>Akun</label>
          <select value={form.accountId} onChange={update('accountId')} required>
            <option value="">Pilih akun</option>
            {accounts.filter((a) => a.status === 'active').map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Kategori</label>
          <select value={form.categoryId} onChange={update('categoryId')}>
            <option value="">Pilih kategori</option>
            {catOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="field">
        <label>Tanggal</label>
        <input type="date" value={form.transactionDate} onChange={update('transactionDate')} required />
      </div>
      <div className="field">
        <label>Keterangan</label>
        <textarea rows="2" value={form.description} onChange={update('description')} placeholder="Catatan opsional..." />
      </div>

      <div className="form-actions">
        {onCancel && <button type="button" className="secondary" onClick={onCancel}>Batal</button>}
        <button type="submit" disabled={loading}>
          {loading ? 'Menyimpan...' : 'Simpan Transaksi'}
        </button>
      </div>
    </form>
  );
}
