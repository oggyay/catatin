export function formatIDR(value) {
  const n = Number(value || 0);
  return 'Rp' + Math.round(n).toLocaleString('id-ID');
}

export function formatDateID(date) {
  const d = date instanceof Date ? date : new Date(date);
  const bulan = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
}
