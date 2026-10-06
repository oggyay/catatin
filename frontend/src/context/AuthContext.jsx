import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setTenants([]);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
      setTenants(data.tenants || []);
    } catch {
      setUser(null);
      setTenants([]);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async ({ token, user, tenants: t }) => {
    setToken(token);
    sessionStorage.setItem('catatin_show_whatsapp_prompt', '1');
    setUser(user);
    setTenants(t || []);
  };

  const switchTenant = async (tenantId) => {
    const { data } = await api.post('/auth/switch-tenant', { tenantId });
    setToken(data.token);
    setUser(data.user);
    window.location.reload();
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    setToken(null);
    setUser(null);
    setTenants([]);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, tenants, loading, login, logout, switchTenant, reloadUser: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
