import { useNavigate } from 'react-router-dom';
import TransactionForm from '../components/TransactionForm.jsx';

export default function NewTransaction() {
  const navigate = useNavigate();

  return (
    <div className="page new-trx-page">
      <div className="new-trx-hero">
        <div className="eyebrow-dark">Catat Keuangan</div>
        <h1>Tambah Transaksi</h1>
        <p>Catat pemasukan atau pengeluaran dengan cepat.</p>
      </div>
      <div className="card new-trx-card">
        <TransactionForm
          onCancel={() => navigate(-1)}
          onSuccess={() => navigate('/transactions')}
        />
      </div>
    </div>
  );
}
