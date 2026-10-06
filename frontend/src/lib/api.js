import axios from 'axios';
import toast from 'react-hot-toast';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

const TOKEN_KEY = 'catatin_token';
const SUBSCRIPTION_MESSAGES = new Set([
  'Langganan tidak aktif',
  'Masa trial sudah berakhir',
  'Tenant tidak aktif',
]);

export function shouldGoToSubscription(user) {
  const tenant = user?.tenant;
  if (!tenant) return false;
  if (tenant.subscriptionStatus === 'inactive' || tenant.subscriptionStatus === 'suspended') return true;
  return tenant.subscriptionStatus === 'trial' && tenant.trialEndsAt && new Date(tenant.trialEndsAt) < new Date();
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  
  // Offline Demo Mock Provider (for screenshots & sandbox)
  if (localStorage.getItem('catatin_demo') === '1') {
    const url = config.url || '';
    if (url.includes('/auth/me')) {
      config.adapter = async () => ({
        data: {
          user: { id: 'u1', name: 'Toko Berkah (Demo)', whatsappNumber: '081234567890', role: 'owner', tenant: { id: 't1', name: 'Toko Berkah UMKM', type: 'umkm', subscriptionStatus: 'active' } },
          tenants: [{ id: 't1', name: 'Toko Berkah UMKM' }]
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      });
    } else if (url.includes('/dashboard/summary')) {
      config.adapter = async () => ({
        data: {
          data: {
            totalBalance: 24500000,
            incomeThisMonth: 15800000,
            expenseThisMonth: 6350000,
            netCashflow: 9450000,
            totalAccounts: 3,
            totalTransactions: 58
          }
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      });
    } else if (url.includes('/dashboard/recent-transactions')) {
      config.adapter = async () => ({
        data: {
          data: [
            { id: '1', date: new Date().toISOString(), type: 'income', amount: 3500000, category: { name: 'Penjualan Online' }, account: { name: 'BCA Bisnis' }, note: 'Order Tokopedia #4821', source: 'whatsapp' },
            { id: '2', date: new Date().toISOString(), type: 'expense', amount: 1250000, category: { name: 'Bahan Baku' }, account: { name: 'Kas Operasional' }, note: 'Restock bahan kemasan', source: 'whatsapp' },
            { id: '3', date: new Date(Date.now() - 86400000).toISOString(), type: 'expense', amount: 450000, category: { name: 'Listrik & Utilitas' }, account: { name: 'Mandiri Giro' }, note: 'Token PLN Toko', source: 'web' },
            { id: '4', date: new Date(Date.now() - 172800000).toISOString(), type: 'income', amount: 2800000, category: { name: 'Penjualan Outlet' }, account: { name: 'Kas Operasional' }, note: 'Setoran kasir harian', source: 'whatsapp' }
          ]
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      });
    } else if (url.includes('/accounts')) {
      config.adapter = async () => ({
        data: {
          data: [
            { id: '1', name: 'Kas Operasional', type: 'cash', balance: 4500000, status: 'active' },
            { id: '2', name: 'BCA Bisnis', type: 'bank', balance: 16500000, status: 'active' },
            { id: '3', name: 'Mandiri Giro', type: 'bank', balance: 3500000, status: 'active' }
          ]
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      });
    } else if (url.includes('/reports/cashflow')) {
      config.adapter = async () => ({
        data: {
          data: {
            summary: { income: 15800000, expense: 6350000, net: 9450000 },
            topIncomeCategories: [{ name: 'Penjualan Online', total: 10500000 }, { name: 'Penjualan Outlet', total: 5300000 }],
            topExpenseCategories: [
              { name: 'Bahan Baku', total: 3500000 },
              { name: 'Operasional', total: 1850000 },
              { name: 'Utilitas', total: 1000000 }
            ]
          }
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      });
    }
  }

  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const message =
      err?.response?.data?.message ||
      err?.message ||
      'Terjadi kesalahan jaringan';

    if (status === 401) {
      setToken(null);
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    } else if (status === 403 && SUBSCRIPTION_MESSAGES.has(message) && !window.location.pathname.startsWith('/settings/subscription')) {
      toast.error(message);
      window.location.href = '/settings/subscription';
    } else if (status >= 400) {
      toast.error(message);
    }
    return Promise.reject(err);
  }
);
