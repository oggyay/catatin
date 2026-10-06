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
