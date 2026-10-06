import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../lib/api.js';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    whatsappNumber: '',
    businessName: '',
    type: 'personal',
  });
  const [loading, setLoading] = useState(false);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/register', form);
      toast.success('OTP dikirim ke WhatsApp');
      sessionStorage.setItem('catatin_wa', form.whatsappNumber);
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
        <h1>Daftar akun baru</h1>
        <div className="sub">Buat akun untuk mulai mencatat keuangan dengan mudah.</div>
        <form onSubmit={submit}>
          <div className="field">
            <label>Nama Lengkap</label>
            <input value={form.name} onChange={update('name')} required autoFocus />
          </div>
          <div className="field">
            <label>Nomor WhatsApp</label>
            <input value={form.whatsappNumber} onChange={update('whatsappNumber')} placeholder="08xxxxxxxxx" required />
          </div>
          <div className="field">
            <label>Nama Akun / Bisnis</label>
            <input value={form.businessName} onChange={update('businessName')} required />
          </div>
          <div className="field">
            <label>Tipe Akun</label>
            <select value={form.type} onChange={update('type')}>
              <option value="personal">Personal</option>
              <option value="umkm">UMKM</option>
            </select>
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Memproses...' : 'Daftar'}
          </button>
        </form>
        <div className="auth-footer">
          Sudah punya akun? <Link to="/login">Masuk</Link>
        </div>
      </div>
    </div>
  );
}
