import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, shouldGoToSubscription } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function VerifyOtp() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [whatsappNumber, setNumber] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const wa = sessionStorage.getItem('catatin_wa');
    if (wa) setNumber(wa);
  }, []);

  const resend = async () => {
    try {
      await api.post('/auth/request-otp', { whatsappNumber, purpose: 'login' });
      toast.success('OTP dikirim ulang');
    } catch {}
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-otp', { whatsappNumber, code });
      await login(data);
      toast.success('Berhasil masuk');
      if (data.user.role === 'platform_admin') navigate('/admin/tenants');
      else if (shouldGoToSubscription(data.user)) navigate('/settings/subscription');
      else navigate('/dashboard');
    } catch {
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-name">CatatIN</div>
          <div className="auth-brand-tagline">Pencatatan Keuangan Sederhana</div>
        </div>
        <h1>Verifikasi kode</h1>
        <div className="sub">Masukkan kode OTP yang dikirim ke WhatsApp Anda.</div>
        <form onSubmit={submit}>
          <div className="field">
            <label>Nomor WhatsApp</label>
            <input value={whatsappNumber} onChange={(e) => setNumber(e.target.value)} required />
          </div>
          <div className="field">
            <label>Kode OTP</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6 digit" required />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Memverifikasi...' : 'Verifikasi'}
          </button>
        </form>
        <button type="button" className="ghost" style={{ marginTop: 12, width: '100%' }} onClick={resend}>
          Kirim ulang OTP
        </button>
        <div className="auth-footer">Kode akan dikirim ke nomor WhatsApp aktif Anda.</div>
      </div>
    </div>
  );
}
