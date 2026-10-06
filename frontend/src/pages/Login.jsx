import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api.js';

export default function Login() {
  const navigate = useNavigate();
  const [whatsappNumber, setNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/request-otp', { whatsappNumber, purpose: 'login' });
      toast.success('OTP dikirim ke WhatsApp');
      sessionStorage.setItem('catatin_wa', whatsappNumber);
      navigate('/verify-otp');
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
        <h1>Selamat datang</h1>
        <div className="sub">Masukkan nomor WhatsApp Anda untuk menerima kode OTP.</div>
        <form onSubmit={submit}>
          <div className="field">
            <label>Nomor WhatsApp</label>
            <input
              value={whatsappNumber}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="08xxxxxxxxx"
              required
              autoFocus
            />
            <div className="hint">Gunakan nomor WhatsApp yang aktif.</div>
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Mengirim...' : 'Kirim OTP'}
          </button>
        </form>
        <div className="auth-footer">
          Belum punya akun? <Link to="/register">Daftar di sini</Link>
        </div>
      </div>
    </div>
  );
}
