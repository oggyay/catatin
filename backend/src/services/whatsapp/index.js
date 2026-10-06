import { mockProvider } from './mock.provider.js';
import { wahaProvider } from './waha.provider.js';
import { waAkgProvider } from './waakg.provider.js';

function getProvider() {
  const name = (process.env.WA_PROVIDER || 'mock').toLowerCase();
  switch (name) {
    case 'waha':
      return wahaProvider;
    case 'wa-akg':
    case 'waakg':
      return waAkgProvider;
    case 'mock':
    default:
      return mockProvider;
  }
}

export async function sendWhatsapp(to, message) {
  const provider = getProvider();
  try {
    return await provider.send(to, message);
  } catch (e) {
    console.error('[WA send error]', e.message);
    // fail open for dev to not block OTP flow
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[WA fallback log] to=${to} msg=${message}`);
      return { ok: false, error: e.message, fallback: true };
    }
    throw e;
  }
}

export async function sendWhatsappSeen(to, options = {}) {
  const provider = getProvider();
  if (typeof provider.seen !== 'function') return { ok: false, skipped: true };
  try {
    return await provider.seen(to, options);
  } catch (e) {
    if (process.env.LOG_LEVEL !== 'error' && process.env.LOG_LEVEL !== 'silent') {
      console.warn('[WA seen warning]', e.message);
    }
    return { ok: false, error: e.message };
  }
}

export function currentProviderName() {
  return (process.env.WA_PROVIDER || 'mock').toLowerCase();
}
