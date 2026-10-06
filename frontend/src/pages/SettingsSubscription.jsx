import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const PLAN_LABELS = {
  free: 'Free',
  basic: 'Basic',
  pro: 'Pro',
};

const STATUS_LABELS = {
  trial: 'Trial',
  active: 'Aktif',
  suspended: 'Ditangguhkan',
  inactive: 'Tidak Aktif',
};

export default function SettingsSubscription() {
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/settings/subscription');
        setData(res.data.data);
      } catch {}
    })();
  }, []);

  const isBlocked = data && (
    data.tenant.subscriptionStatus === 'inactive' ||
    data.tenant.subscriptionStatus === 'suspended' ||
    data.tenant.trialExpired
  );

  return (
    <div className="page">
      <div className="transactions-hero mb-24">
        <div>
          <div className="eyebrow">Pengaturan</div>
          <h1 className="page-title">Subscription & Billing</h1>
          <p>Informasi paket, status langganan, dan batas penggunaan akun Anda.</p>
        </div>
      </div>

      {!data ? (
        <div className="card"><div className="empty">Memuat...</div></div>
      ) : (
        <>
          {isBlocked && (
            <div className="card mb-16 settings-alert-card">
              <h3>{data.tenant.trialExpired ? 'Masa trial sudah berakhir' : 'Langganan tidak aktif'}</h3>
              <p>
                {data.tenant.trialExpired
                  ? 'Masa trial Anda sudah berakhir. Hubungi admin untuk mengaktifkan atau upgrade plan.'
                  : 'Langganan Anda sedang tidak aktif atau ditangguhkan. Hubungi admin untuk informasi lebih lanjut.'}
              </p>
            </div>
          )}

          <div className="grid cols-3 mb-16">
            <div className="kpi interactive-kpi">
              <div className="label">Plan</div>
              <div className="value">{PLAN_LABELS[data.tenant.subscriptionPlan] || data.tenant.subscriptionPlan}</div>
              <div className="kpi-foot">{data.tenant.type === 'umkm' ? 'UMKM' : 'Personal'}</div>
            </div>
            <div className="kpi interactive-kpi">
              <div className="label">Status</div>
              <div className={`value ${isBlocked ? 'neg' : 'pos'}`}>{STATUS_LABELS[data.tenant.subscriptionStatus] || data.tenant.subscriptionStatus}</div>
              {data.tenant.trialExpired && <div className="kpi-foot neg">Trial sudah berakhir</div>}
            </div>
            <div className="kpi interactive-kpi">
              <div className="label">Trial berakhir</div>
              <div className="value">{data.tenant.trialEndsAt ? String(data.tenant.trialEndsAt).slice(0, 10) : '-'}</div>
            </div>
          </div>

          <div className="grid cols-2 mb-16">
            <div className="card">
              <div className="settings-card-head">
                <h3>Penggunaan saat ini</h3>
                <p>Batas berdasarkan plan aktif Anda.</p>
              </div>
              <div className="settings-usage-list">
                <div className="settings-usage-item">
                  <span>Pengguna aktif</span>
                  <strong className={data.usage.users >= data.limits.maxUsers ? 'neg' : ''}>
                    {data.usage.users} / {data.limits.maxUsers}
                    {data.usage.users >= data.limits.maxUsers && <span className="badge expense" style={{ marginLeft: 8 }}>Limit</span>}
                  </strong>
                </div>
                <div className="settings-usage-item">
                  <span>Akun</span>
                  <strong className={data.usage.accounts >= data.limits.maxAccounts ? 'neg' : ''}>
                    {data.usage.accounts} / {data.limits.maxAccounts}
                    {data.usage.accounts >= data.limits.maxAccounts && <span className="badge expense" style={{ marginLeft: 8 }}>Limit</span>}
                  </strong>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="settings-card-head">
                <h3>Fitur Plan {PLAN_LABELS[data.tenant.subscriptionPlan]}</h3>
                <p>Fitur yang tersedia di paket Anda.</p>
              </div>
              <div className="settings-usage-list">
                <div className="settings-usage-item">
                  <span>WhatsApp Bot</span>
                  <span className={`badge ${data.limits.whatsappBot ? 'active' : 'inactive'}`}>
                    {data.limits.whatsappBot ? 'Aktif' : 'Tidak aktif'}
                  </span>
                </div>
                <div className="settings-usage-item">
                  <span>Maks. pengguna</span>
                  <strong>{data.limits.maxUsers}</strong>
                </div>
                <div className="settings-usage-item">
                  <span>Maks. akun</span>
                  <strong>{data.limits.maxAccounts}</strong>
                </div>
              </div>
              {!data.limits.whatsappBot && (
                <p className="hint" style={{ marginTop: 12 }}>WhatsApp Bot tersedia mulai plan Basic. Hubungi admin untuk upgrade.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
