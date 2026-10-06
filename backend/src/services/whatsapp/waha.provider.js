/**
 * WAHA provider - https://waha.devlike.pro
 * Endpoint default: POST {WAHA_BASE_URL}/api/sendText
 * Body: { session, chatId, text }
 */
export const wahaProvider = {
  name: 'waha',
  async seen(to, { messageId = null, participant = null } = {}) {
    const baseUrl = process.env.WAHA_BASE_URL;
    const session = process.env.WAHA_SESSION || 'default';
    const apiKey = process.env.WAHA_API_KEY;
    if (!baseUrl || !messageId) return { ok: false, skipped: true };

    const rawTo = String(to || '').trim();
    const chatId = rawTo.includes('@') ? rawTo : `${rawTo}@c.us`;
    const headers = { 'Content-Type': 'application/json', accept: 'application/json' };
    if (apiKey) headers['X-Api-Key'] = apiKey;

    const payload = { session, chatId, messageIds: [messageId], participant };
    if (process.env.WAHA_DEBUG_SEEN === 'true') {
      console.log('[WAHA sendSeen request]', payload);
    }

    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/sendSeen`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text();
      if (process.env.WAHA_DEBUG_SEEN === 'true') {
        console.log('[WAHA sendSeen response]', res.status, t);
      }
      throw new Error(`WAHA sendSeen failed ${res.status}: ${t}`);
    }
    const data = await res.json().catch(() => ({}));
    if (process.env.WAHA_DEBUG_SEEN === 'true') {
      console.log('[WAHA sendSeen response]', res.status, data);
    }
    return { ok: true, provider: 'waha', data };
  },
  async send(to, message) {
    const baseUrl = process.env.WAHA_BASE_URL;
    const session = process.env.WAHA_SESSION || 'default';
    const apiKey = process.env.WAHA_API_KEY;

    if (!baseUrl) throw new Error('WAHA_BASE_URL belum di-set');

    const rawTo = String(to || '').trim();
    const chatId = rawTo.includes('@') ? rawTo : `${rawTo}@c.us`;
    if (!rawTo || rawTo === '@c.us') {
      throw new Error('Nomor tujuan WhatsApp kosong');
    }
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['X-Api-Key'] = apiKey;

    const root = baseUrl.replace(/\/$/, '');
    const callWaha = async (endpoint, payload) => {
      const res = await fetch(`${root}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`WAHA ${endpoint} failed ${res.status}: ${t}`);
      }
      return res.json().catch(() => ({}));
    };

    const bestEffort = async (endpoint, payload) => {
      try {
        return await callWaha(endpoint, payload);
      } catch (e) {
        if (process.env.LOG_LEVEL !== 'error' && process.env.LOG_LEVEL !== 'silent') {
          console.warn(`[WAHA optional] ${e.message}`);
        }
        return null;
      }
    };

    if (process.env.WAHA_TYPING_ENABLED !== 'false') {
      await bestEffort('/api/startTyping', { session, chatId });
    }

    const typingDelayMs = Math.min(Number(process.env.WAHA_TYPING_DELAY_MS || 700), 3000);
    if (typingDelayMs > 0 && process.env.WAHA_TYPING_ENABLED !== 'false') {
      await new Promise((resolve) => setTimeout(resolve, typingDelayMs));
    }

    let data;
    try {
      data = await callWaha('/api/sendText', { session, chatId, text: message });
    } finally {
      if (process.env.WAHA_TYPING_ENABLED !== 'false') {
        await bestEffort('/api/stopTyping', { session, chatId });
      }
    }
    return { ok: true, provider: 'waha', data };
  },
};
