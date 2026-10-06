import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import AppLayout from './components/AppLayout.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import VerifyOtp from './pages/VerifyOtp.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Transactions from './pages/Transactions.jsx';
import NewTransaction from './pages/NewTransaction.jsx';
import Accounts from './pages/Accounts.jsx';
import Categories from './pages/Categories.jsx';
import CashflowReport from './pages/CashflowReport.jsx';
import SettingsProfile from './pages/SettingsProfile.jsx';
import SettingsUsers from './pages/SettingsUsers.jsx';
import SettingsSubscription from './pages/SettingsSubscription.jsx';
import SettingsWhatsapp from './pages/SettingsWhatsapp.jsx';
import AdminTenants from './pages/AdminTenants.jsx';
import AdminTenantDetail from './pages/AdminTenantDetail.jsx';
import AdminUsage from './pages/AdminUsage.jsx';

import DebtPage from './pages/DebtPage.jsx';

function Protected({ children, platformAdmin = false }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="auth-screen">Memuat...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (platformAdmin && user.role !== 'platform_admin') return <Navigate to="/dashboard" replace />;
  if (!platformAdmin && user.role === 'platform_admin') return <Navigate to="/admin/tenants" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-otp" element={<VerifyOtp />} />

      <Route
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/transactions/new" element={<NewTransaction />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/debt" element={<DebtPage />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/reports/cashflow" element={<CashflowReport />} />
        <Route path="/settings/profile" element={<SettingsProfile />} />
        <Route path="/settings/users" element={<SettingsUsers />} />
        <Route path="/settings/subscription" element={<SettingsSubscription />} />
        <Route path="/settings/whatsapp" element={<SettingsWhatsapp />} />
      </Route>

      <Route
        element={
          <Protected platformAdmin>
            <AppLayout platformAdmin />
          </Protected>
        }
      >
        <Route path="/admin/tenants" element={<AdminTenants />} />
        <Route path="/admin/tenants/:id" element={<AdminTenantDetail />} />
        <Route path="/admin/usage" element={<AdminUsage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
