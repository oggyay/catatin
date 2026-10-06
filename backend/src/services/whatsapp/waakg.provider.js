/**
 * WA-AKG / AKG gateway provider.
 * Generic adapter. Adjust endpoint as needed per your gateway docs.
 * Default expects: POST {WA_AKG_BASE_URL}/send with JSON { number, message, device }
 * Auth via Authorization: Bearer <WA_AKG_API_KEY>
 */
export const waAkgProvider = {
  name: 'wa-akg',
  async send(to, message) {
    const baseUrl = process.env.WA_AKG_BASE_URL;
    const apiKey = process.env.WA_AKG_API_KEY;
    const device = process.env.WA_AKG_DEVICE_ID;

    if (!baseUrl) throw new Error('WA_AKG_BASE_URL belum di-set');

    const url = `${baseUrl.replace(/\/$/, '')}/send`;
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const body = { number: to, message };
    if (device) body.device = device;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`WA-AKG send failed ${res.status}: ${t}`);
    }
    const data = await res.json().catch(() => ({}));
    return { ok: true, provider: 'wa-akg', data };
  },
};
