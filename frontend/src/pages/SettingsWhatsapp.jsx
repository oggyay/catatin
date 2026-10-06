import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function SettingsWhatsapp() {
  const { user, reloadUser } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const pollRef = useRef(null);

  const commands = [
    { label: 'Cek saldo', example: 'saldo' },
    { label: 'Cek saldo akun tertentu', example: 'saldo bca' },
    { label: 'Cek pengeluaran', example: 'pengeluaran bulan ini' },
    { label: 'Cek pemasukan', example: 'pemasukan minggu ini' },
    { label: 'Catat pengeluaran', example: 'keluar 50000 makan siang' },
    { label: 'Catat pemasukan', example: 'masuk 250000 jualan' },
    { label: 'Konfirmasi transaksi', example: 'ya' },
    { label: 'Batalkan transaksi', example: 'batal' },
    { label: 'Bantuan', example: 'help' },
  ];

  const load = async () => {
    try {
      const { data } = await api.get('/settings/whatsapp');
      setStatus(data.data);
      return data.data;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const s = await load();
      const expired = s?.activeRequest && new Date(s.activeRequest.expiresAt) <= new Date();
      if (s?.linked) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        toast.success('WhatsApp berhasil terhubung');
        reloadUser();
      } else if (!s?.activeRequest || expired) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 3000);
  };

  const requestLink = async () => {
    setRequesting(true);
    try {
      await api.post('/settings/whatsapp/link-request');
      toast.success('Permintaan konfirmasi dikirim ke WhatsApp Anda');
      await load();
      startPolling();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Gagal mengirim permintaan');
    } finally {
      setRequesting(false);
    }
  };

  const cancelRequest = async () => {
    await api.delete('/settings/whatsapp/link-request');
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    toast.success('Permintaan dibatalkan');
    await load();
  };

  const unlink = async () => {
    if (!confirm('Putuskan koneksi WhatsApp dari akun ini?')) return;
    await api.delete('/settings/whatsapp/link');
    toast.success('WhatsApp diputuskan');
    await Promise.all([load(), reloadUser()]);
  };

  const linked = Boolean(status?.linked || user?.whatsappLinked);
  const activeRequest = status?.activeRequest;
  const requestExpired = activeRequest && new Date(activeRequest.expiresAt) <= new Date();
  const requestActive = activeRequest && !requestExpired;

  return (
    <div className="page">
      <div className="transactions-hero mb-24">
        <div>
          <div className="eyebrow">Pengaturan</div>
          <h1 className="page-title">WhatsApp Bot</h1>
          <p>Hubungkan WhatsApp untuk catat transaksi, cek saldo, dan laporan langsung dari chat.</p>
        </div>
      </div>

      <div className="card mb-16 whatsapp-binding-card">
        <div className="section-head">
          <div>
            <h2>Status koneksi</h2>
            <p>Hubungkan WhatsApp agar bot bisa mengenali chat Anda, termasuk jika WAHA memakai format @lid.</p>
          </div>
          <span className={`badge ${linked ? 'active' : 'inactive'}`}>
            {linked ? 'Terhubung' : 'Belum terhubung'}
          </span>
        </div>

        <div className="binding-status-grid">
          <div>
            <span>Nomor login</span>
            <strong>{status?.whatsappNumber || user?.whatsappNumber}</strong>
          </div>
          <div>
            <span>WhatsApp ID</span>
            <strong>{status?.whatsappJid || '-'}</strong>
          </div>
        </div>

        {!linked ? (
          <div className="binding-box">
            <h3>Hubungkan WhatsApp</h3>
            {requestActive ? (
              <>
                <p>
                  Kami sudah mengirim pesan konfirmasi ke WhatsApp{' '}
                  <strong>{activeRequest.whatsappNumber}</strong>. Balas <b>YA</b> pada chat tersebut
                  sebelum {new Date(activeRequest.expiresAt).toLocaleTimeString('id-ID')}.
                </p>
                <p className="muted" style={{ fontSize: 13 }}>
                  Halaman ini akan otomatis terupdate begitu Anda konfirmasi.
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="secondary" onClick={cancelRequest}>Batalkan</button>
                  <button onClick={requestLink} disabled={requesting}>
                    {requesting ? 'Mengirim...' : 'Kirim ulang'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p>
                  Klik tombol di bawah, kami akan kirim pesan konfirmasi ke nomor WhatsApp Anda.
                  Balas <b>YA</b> pada chat tersebut untuk menyelesaikan penghubungan.
                </p>
                <button onClick={requestLink} disabled={requesting || loading}>
                  {requesting ? 'Mengirim...' : 'Hubungkan WhatsApp'}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="binding-box success">
            <h3>WhatsApp sudah terhubung</h3>
            <p>Anda bisa menggunakan command saldo, pemasukan, pengeluaran, dan input transaksi dari WhatsApp.</p>
            <button className="secondary" onClick={unlink}>Putuskan hubungan</button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="settings-card-head">
          <h3>Daftar command</h3>
          <p>Contoh perintah yang bisa Anda kirim ke bot WhatsApp.</p>
        </div>
        <div className="settings-commands-list">
          {commands.map((c) => (
            <div className="settings-command-item" key={c.label}>
              <span>{c.label}</span>
              <code>{c.example}</code>
            </div>
          ))}
        </div>
        <p className="hint mt-8">
          Parser WhatsApp mengerti variasi nominal seperti "50rb", "1 juta", "2.5 juta",
          serta typo ringan pada kata kunci. Setiap transaksi dari WhatsApp akan meminta
          konfirmasi <b>YA</b> sebelum tersimpan.
        </p>
      </div>
    </div>
  );
}
