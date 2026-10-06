export function normalizeWhatsappNumber(raw) {
  if (!raw) return '';
  let n = String(raw).trim();
  n = n.replace(/[^\d+]/g, '');
  if (n.startsWith('+')) n = n.slice(1);
  if (n.startsWith('00')) n = n.slice(2);
  if (n.startsWith('0')) n = '62' + n.slice(1);
  if (n.startsWith('8')) n = '62' + n;
  return n;
}

export function maskWhatsapp(number) {
  if (!number) return '';
  const last = number.slice(-4);
  return number.slice(0, 3) + '****' + last;
}
