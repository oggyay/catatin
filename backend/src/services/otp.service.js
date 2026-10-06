import bcrypt from 'bcryptjs';
import { HttpError } from '../utils/error.js';
import { sendWhatsapp } from './whatsapp/index.js';
import { getRedis } from '../config/redis.js';

function generateOtpCode(length = 6) {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

export async function requestOtp({ whatsappNumber, purpose = 'login', userId = null }) {
  const expiresMinutes = Number(process.env.OTP_EXPIRES_MINUTES || 5);
  const rateLimitCount = Number(process.env.OTP_RATE_LIMIT_COUNT || process.env.OTP_RATE_LIMIT_PER_HOUR || 3);
  const rateLimitWindowMinutes = Number(process.env.OTP_RATE_LIMIT_WINDOW_MINUTES || 15);
  const redis = await getRedis();

  const rateKey = `otp:rate:${whatsappNumber}`;
  const recentCount = await redis.incr(rateKey);
  if (recentCount === 1) await redis.expire(rateKey, rateLimitWindowMinutes * 60);
  if (recentCount > rateLimitCount) {
    throw new HttpError(429, 'Terlalu banyak permintaan OTP. Coba lagi nanti.');
  }

  const code = generateOtpCode(Number(process.env.OTP_LENGTH || 6));
  const otpHash = await bcrypt.hash(code, 10);

  const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);
  const otpKey = `otp:${purpose}:${whatsappNumber}`;

  await redis.set(
    otpKey,
    JSON.stringify({
      userId,
      whatsappNumber,
      otpHash,
      purpose,
      attempts: 0,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
    }),
    { EX: expiresMinutes * 60 }
  );

  const message =
    `Kode OTP Anda: *${code}*\n` +
    `Berlaku ${expiresMinutes} menit.\n` +
    `Jangan bagikan kode ini ke siapapun.\n\n` +
    `— CatatIN`;

  await sendWhatsapp(whatsappNumber, message);

  return { otpId: otpKey, expiresAt };
}

export async function verifyOtp({ whatsappNumber, code, purpose = null }) {
  const maxAttempts = Number(process.env.OTP_MAX_ATTEMPTS || 5);
  const redis = await getRedis();
  const keys = purpose
    ? [`otp:${purpose}:${whatsappNumber}`]
    : [`otp:login:${whatsappNumber}`, `otp:register:${whatsappNumber}`];

  let otp = null;
  let otpKey = null;
  for (const key of keys) {
    const raw = await redis.get(key);
    if (raw) {
      otp = JSON.parse(raw);
      otpKey = key;
      break;
    }
  }

  if (!otp) throw new HttpError(400, 'OTP tidak ditemukan atau sudah expired');
  if (otp.attempts >= maxAttempts) {
    throw new HttpError(429, 'Terlalu banyak percobaan OTP');
  }

  const match = await bcrypt.compare(String(code), otp.otpHash);
  if (!match) {
    const ttl = await redis.ttl(otpKey);
    if (ttl > 0) {
      await redis.set(otpKey, JSON.stringify({ ...otp, attempts: otp.attempts + 1 }), { EX: ttl });
    }
    throw new HttpError(400, 'Kode OTP salah');
  }

  await redis.del(otpKey);

  return otp;
}
