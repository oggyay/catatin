import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export default function AdminUsage() {
  const [usage, setUsage] = useState(null);
  useEffect(() => {
    (async () => {
      const { data } = await api.get('/admin/usage');
      setUsage(data.data);
    })();
  }, []);

  if (!usage) return <div className="page">Memuat...</div>;

  return (
    <div className="page">
      <h1 className="page-title">Platform Usage</h1>
      <div className="grid cols-4 mb-16">
        <div className="kpi"><div className="label">Tenants</div><div className="value">{usage.tenants}</div></div>
        <div className="kpi"><div className="label">Users</div><div className="value">{usage.users}</div></div>
        <div className="kpi"><div className="label">Transaksi</div><div className="value">{usage.transactions}</div></div>
        <div className="kpi"><div className="label">WhatsApp Logs</div><div className="value">{usage.whatsappLogs}</div></div>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Tenant per Tipe</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Tipe</th><th>Jumlah</th></tr></thead>
            <tbody>
              {usage.tenantsByType.map((t) => (
                <tr key={t.type}><td>{t.type === 'umkm' ? 'UMKM' : 'Personal'}</td><td>{t.count}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
