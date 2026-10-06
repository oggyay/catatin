import dayjs from 'dayjs';
import { prisma } from '../config/prisma.js';
import { parseCommand } from './whatsapp/parser.js';
import { sendWhatsapp } from './whatsapp/index.js';
import { normalizeWhatsappNumber } from '../utils/phone.js';
import { formatIDR, formatDateID } from '../utils/format.js';
import { getPeriodRange } from '../utils/period.js';
import { createTransactionAtomic, createTransferAtomic } from './transaction.service.js';
import { getPlanLimits } from '../config/plans.js';
import { getRedis } from '../config/redis.js';

const CONFIRM_WORDS = ['ya', 'y', 'ok', 'oke', 'iya', 'konfirm', 'konfirmasi'];
const CANCEL_WORDS = ['batal', 'cancel', 'tidak', 'nggak', 'ngga', 'gak', 'no'];

function isYes(t) {
  return CONFIRM_WORDS.includes(String(t || '').trim().toLowerCase());
}
function isNo(t) {
  return CANCEL_WORDS.includes(String(t || '').trim().toLowerCase());
}

async function logWA({ tenantId, whatsappNumber, direction, message, intent, meta }) {
  try {
    await prisma.whatsappLog.create({
      data: { tenantId: tenantId || null, whatsappNumber, direction, message, intent, meta },
    });
  } catch (e) {
    console.warn('[WA log] gagal simpan log:', e.message);
  }
}

async function reply(to, message, ctx = {}) {
  await sendWhatsapp(to, message);
  await logWA({
    tenantId: ctx.tenantId,
    whatsappNumber: to,
    direction: 'outbound',
    message,
    intent: ctx.intent,
    meta: ctx.meta,
  });
}

export async function handleIncomingMessage({ from, fromCandidates = [], body, replyTo: externalReplyTo = null, isGroup = false }) {
  const rawFrom = String(from || '').trim();
  const isJid = rawFrom.includes('@');
  const whatsappNumber = isJid ? normalizeWhatsappNumber(rawFrom.split('@')[0]) : normalizeWhatsappNumber(rawFrom);
  const candidateValues = Array.from(new Set([rawFrom, ...fromCandidates].filter(Boolean).map((v) => String(v).trim())));
  const candidateNumbers = Array.from(new Set(candidateValues.map((v) => normalizeWhatsappNumber(v.split('@')[0])).filter(Boolean)));
  // replyTo: untuk grup → chatId grup (dari caller), untuk DM → sender JID
  const replyTo = externalReplyTo || (isJid ? rawFrom : whatsappNumber);
  const text = String(body || '').trim();

  await logWA({ whatsappNumber: replyTo || whatsappNumber, direction: 'inbound', message: text });

  if (!text) {
    return reply(replyTo, 'Pesan kosong. Ketik *help* untuk daftar perintah.');
  }

  const linkMatch = text.match(/^link\s+(CATATIN-\d{6})$/i);
  if (linkMatch) {
    return handleLinkToken({ token: linkMatch[1].toUpperCase(), replyTo, rawFrom });
  }

  // Auto link-request: user replies YA/BATAL to a pending link request
  if ((candidateNumbers.length || candidateValues.length) && (isYes(text) || isNo(text))) {
    try {
      const redis = await getRedis();
      for (const number of candidateNumbers) {
        const rawLink = await redis.get(`wa:link-request:${number}`);
        if (!rawLink) continue;
        const cached = JSON.parse(rawLink);
        const linkRequest = await prisma.whatsappLinkRequest.findFirst({
          where: { id: cached.id, status: 'pending', expiresAt: { gt: new Date() } },
          include: { user: true },
        });
        if (linkRequest) {
          return handleLinkRequestReply({ linkRequest, approve: isYes(text), replyTo, rawFrom });
        }
      }
    } catch {}

    const linkRequest = await prisma.whatsappLinkRequest.findFirst({
      where: {
        OR: [
          ...(candidateNumbers.length ? [{ whatsappNumber: { in: candidateNumbers } }] : []),
          ...(candidateValues.length ? [{ confirmedJid: { in: candidateValues } }] : []),
        ],
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });
    if (linkRequest) {
      return handleLinkRequestReply({ linkRequest, approve: isYes(text), replyTo, rawFrom });
    }

    if (rawFrom.includes('@lid')) {
      const pendingRequests = await prisma.whatsappLinkRequest.findMany({
        where: { status: 'pending', expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        take: 2,
        include: { user: true },
      });
      if (pendingRequests.length === 1) {
        return handleLinkRequestReply({ linkRequest: pendingRequests[0], approve: isYes(text), replyTo, rawFrom });
      }
    }
  }

  // Find user via AccountIdentity (new) or legacy User (fallback)
  let user = null;

  const identity = await prisma.accountIdentity.findFirst({
    where: {
      OR: [
        ...(candidateNumbers.length ? [{ whatsappNumber: { in: candidateNumbers } }] : []),
        ...(candidateValues.some((v) => v.includes('@')) ? [{ whatsappJid: { in: candidateValues.filter((v) => v.includes('@')) } }] : []),
      ],
    },
  });

  if (identity?.activeTenantId) {
    user = await prisma.user.findFirst({
      where: { identityId: identity.id, tenantId: identity.activeTenantId, deletedAt: null },
      include: { tenant: true },
    });
  }

  if (!user) {
    user = await prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          ...(candidateNumbers.length ? [{ whatsappNumber: { in: candidateNumbers } }] : []),
          ...(candidateValues.some((v) => v.includes('@')) ? [{ whatsappJid: { in: candidateValues.filter((v) => v.includes('@')) } }] : []),
        ],
      },
      include: { tenant: true },
    });
  }

  if (!user) {
    // Di grup: diam saja jika user tidak dikenal (jangan spam grup)
    if (isGroup) return;
    return reply(
      replyTo,
      'WhatsApp ini belum terhubung ke akun CatatIN.\n\nSilakan login ke aplikasi web, buka Pengaturan > WhatsApp, lalu klik *Hubungkan WhatsApp*.'
    );
  }
  if (!user.tenantId) {
    return reply(replyTo, 'Akun Anda belum memiliki tenant aktif.');
  }
  if (user.status !== 'active') {
    return reply(replyTo, 'Akun Anda tidak aktif. Hubungi admin.');
  }
  if (user.tenant?.status === 'inactive') {
    return reply(replyTo, 'Tenant Anda sedang tidak aktif. Hubungi admin.');
  }
  if (user.tenant.subscriptionStatus === 'inactive' || user.tenant.subscriptionStatus === 'suspended') {
    return reply(replyTo, 'Langganan CatatIN tidak aktif. Silakan hubungi admin.');
  }
  if (user.tenant.subscriptionStatus === 'trial' && user.tenant.trialEndsAt && user.tenant.trialEndsAt < new Date()) {
    return reply(replyTo, 'Masa trial CatatIN sudah berakhir. Silakan upgrade lisensi.');
  }
  if (!getPlanLimits(user.tenant.type, user.tenant.subscriptionPlan).whatsappBot) {
    return reply(replyTo, 'Fitur WhatsApp tersedia mulai plan Basic. Silakan upgrade lisensi.');
  }
  user.replyTo = replyTo;

  const tenantId = user.tenantId;

  // Pending confirmation flow
  const pending = await prisma.whatsappPendingTransaction.findFirst({
    where: { userId: user.id, status: 'pending', expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  if (pending) {
    if (isYes(text)) {
      return handleConfirmPending(user, pending);
    }
    if (isNo(text)) {
      await prisma.whatsappPendingTransaction.update({
        where: { id: pending.id },
        data: { status: 'cancelled' },
      });
      return reply(user.replyTo || whatsappNumber, 'Transaksi dibatalkan.', { tenantId, intent: 'batal' });
    }
  }

  // Parse command
  const [accounts, categories] = await Promise.all([
    prisma.account.findMany({ where: { tenantId, status: 'active' } }),
    prisma.category.findMany({ where: { tenantId, status: 'active' } }),
  ]);

  const parsed = await parseCommand(text, { accounts, categories });

  await logWA({
    tenantId,
    whatsappNumber,
    direction: 'inbound',
    message: `[parsed] ${JSON.stringify(parsed)}`,
    intent: parsed.intent,
    meta: parsed,
  });

  switch (parsed.intent) {
    case 'help':
      return sendHelp(user.replyTo || whatsappNumber, tenantId, false, user.tenant?.name, user.tenant?.type);
    case 'cek_saldo':
      return handleCekSaldo(user, text, accounts);
    case 'cek_pengeluaran':
      return handleCekTransaksi(user, parsed, 'expense', categories);
    case 'cek_pemasukan':
      return handleCekTransaksi(user, parsed, 'income', categories);
    case 'riwayat_transaksi':
      return handleRiwayatTransaksi(user, parsed, text);
    case 'input_pengeluaran':
      return handleInputTransaksi(user, parsed, 'expense', accounts, categories, text);
    case 'input_pemasukan':
      return handleInputTransaksi(user, parsed, 'income', accounts, categories, text);
    case 'transfer_akun':
      return handleTransferAkun(user, parsed, accounts, text);
    case 'cek_hutang':
      return handleCekHutangPiutang(user, accounts, 'hutang');
    case 'cek_piutang':
      return handleCekHutangPiutang(user, accounts, 'piutang');
    case 'catat_hutang':
      return handleCatatHutangPiutang(user, parsed, accounts, text, 'catat_hutang');
    case 'bayar_hutang':
      return handleCatatHutangPiutang(user, parsed, accounts, text, 'bayar_hutang');
    case 'catat_piutang':
      return handleCatatHutangPiutang(user, parsed, accounts, text, 'catat_piutang');
    case 'terima_piutang':
      return handleCatatHutangPiutang(user, parsed, accounts, text, 'terima_piutang');
    case 'konfirmasi':
    case 'batal':
      return reply(whatsappNumber, 'Tidak ada transaksi pending.', { tenantId, intent: parsed.intent });
    default:
      return sendHelp(user.replyTo || whatsappNumber, tenantId, true, user.tenant?.name, user.tenant?.type);
  }
}

async function handleLinkToken({ token, replyTo, rawFrom }) {
  if (!rawFrom.includes('@')) {
    return reply(
      replyTo,
      'Kode diterima, tetapi WhatsApp ID belum terbaca. Coba kirim ulang dari chat WhatsApp yang sama.'
    );
  }

  const linkToken = await prisma.whatsappLinkToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!linkToken || linkToken.usedAt || linkToken.expiresAt <= new Date()) {
    return reply(
      replyTo,
      'Kode hubungkan tidak valid atau sudah expired. Buat kode baru dari menu Pengaturan > WhatsApp.'
    );
  }

  await prisma.$transaction(async (tx) => {
    const linkedUser = await tx.user.update({
      where: { id: linkToken.userId },
      data: { whatsappJid: rawFrom },
      select: { identityId: true },
    });
    if (linkedUser.identityId) {
      await tx.accountIdentity.update({
        where: { id: linkedUser.identityId },
        data: { whatsappJid: rawFrom },
      });
    }
    await tx.whatsappLinkToken.update({
      where: { id: linkToken.id },
      data: { usedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        tenantId: linkToken.tenantId,
        userId: linkToken.userId,
        action: 'whatsapp.link',
        entityType: 'user',
        entityId: linkToken.userId,
        newValue: { whatsappJid: rawFrom },
      },
    });
  });

  return reply(
    replyTo,
    `WhatsApp berhasil terhubung ke akun CatatIN atas nama ${linkToken.user.name}.\n\nSekarang Anda bisa kirim command seperti:\nsaldo\nkeluar 50000 makan siang`
  );
}

async function handleLinkRequestReply({ linkRequest, approve, replyTo, rawFrom }) {
  if (!approve) {
    await prisma.whatsappLinkRequest.update({
      where: { id: linkRequest.id },
      data: { status: 'cancelled' },
    });
    return reply(replyTo, 'Permintaan hubungkan WhatsApp dibatalkan.');
  }

  if (!rawFrom.includes('@')) {
    return reply(
      replyTo,
      'Konfirmasi diterima, tetapi WhatsApp ID belum terbaca. Coba kirim ulang dari chat WhatsApp yang sama.'
    );
  }

  await prisma.$transaction(async (tx) => {
    const linkedUser = await tx.user.update({
      where: { id: linkRequest.userId },
      data: { whatsappJid: rawFrom },
      select: { identityId: true },
    });
    if (linkedUser.identityId) {
      await tx.accountIdentity.update({
        where: { id: linkedUser.identityId },
        data: { whatsappJid: rawFrom },
      });
    }
    await tx.whatsappLinkRequest.update({
      where: { id: linkRequest.id },
      data: { status: 'confirmed', confirmedAt: new Date(), confirmedJid: rawFrom },
    });
    await tx.auditLog.create({
      data: {
        tenantId: linkRequest.tenantId,
        userId: linkRequest.userId,
        action: 'whatsapp.link',
        entityType: 'user',
        entityId: linkRequest.userId,
        newValue: { whatsappJid: rawFrom, via: 'link-request' },
      },
    });
  });

  return reply(
    replyTo,
    `WhatsApp berhasil terhubung ke akun CatatIN atas nama ${linkRequest.user.name}.\n\nSekarang Anda bisa kirim command seperti:\nsaldo\nkeluar 50000 makan siang`
  );
}

async function handleConfirmPending(user, pending) {
  const payload = pending.parsedPayload;
  try {
    if (payload.kind === 'transfer') {
      const result = await createTransferAtomic({
        tenantId: user.tenantId,
        userId: user.id,
        fromAccountId: payload.fromAccountId,
        toAccountId: payload.toAccountId,
        amount: payload.amount,
        transactionDate: payload.transactionDate || new Date().toISOString(),
        description: payload.description,
        source: 'whatsapp',
      });

      await prisma.whatsappPendingTransaction.update({
        where: { id: pending.id },
        data: { status: 'confirmed' },
      });

      const msg =
        `Transfer berhasil disimpan.\n` +
        `${result.from.name}: ${formatIDR(result.from.currentBalance)}\n` +
        `${result.to.name}: ${formatIDR(result.to.currentBalance)}`;
      return reply(user.replyTo || user.whatsappNumber, msg, { tenantId: user.tenantId, intent: 'konfirmasi' });
    }

    const { transaction, account } = await createTransactionAtomic({
      tenantId: user.tenantId,
      userId: user.id,
      accountId: payload.accountId,
      type: payload.type,
      amount: payload.amount,
      categoryId: payload.categoryId || null,
      transactionDate: payload.transactionDate || new Date().toISOString(),
      description: payload.description,
      source: 'whatsapp',
    });

    await prisma.whatsappPendingTransaction.update({
      where: { id: pending.id },
      data: { status: 'confirmed' },
    });

    const kind = payload.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
    const msg = `${kind} berhasil disimpan.\nSaldo ${account.name} sekarang: ${formatIDR(account.currentBalance)}`;
    return reply(user.replyTo || user.whatsappNumber, msg, { tenantId: user.tenantId, intent: 'konfirmasi' });
  } catch (e) {
    return reply(
      user.replyTo || user.whatsappNumber,
      `Gagal menyimpan transaksi: ${e.message}`,
      { tenantId: user.tenantId, intent: 'error' }
    );
  }
}

async function handleCekSaldo(user, text, accounts) {
  const t = text.toLowerCase();
  // If user mentions an account name
  const mentioned = accounts.find((a) => t.includes(a.name.toLowerCase()));
  if (mentioned) {
    const msg = `Saldo ${mentioned.name}: ${formatIDR(mentioned.currentBalance)}`;
    return reply(user.replyTo || user.whatsappNumber, msg, { tenantId: user.tenantId, intent: 'cek_saldo' });
  }

  const active = accounts.filter(
    (a) => a.status === 'active' && (!['hutang', 'piutang'].includes(a.type) || Number(a.currentBalance) !== 0)
  );
  const total = active.reduce((s, a) => s + Number(a.currentBalance), 0);
  const lines = active.map((a) => `${a.name}: ${formatIDR(a.currentBalance)}`).join('\n');
  const msg = `Saldo Anda saat ini:\n\nTotal: ${formatIDR(total)}\n\n${lines}`;
  return reply(user.replyTo || user.whatsappNumber, msg, { tenantId: user.tenantId, intent: 'cek_saldo' });
}

async function handleCekHutangPiutang(user, accounts, type) {
  const akun = accounts.find((a) => a.type === type && a.status === 'active');
  if (!akun) {
    return reply(
      user.replyTo || user.whatsappNumber,
      `Akun ${type} tidak ditemukan. Coba hubungi admin.`,
      { tenantId: user.tenantId, intent: `cek_${type}` }
    );
  }
  const label = type === 'hutang' ? 'Hutang' : 'Piutang';
  const msg = `${label} saat ini: ${formatIDR(akun.currentBalance)}`;
  return reply(user.replyTo || user.whatsappNumber, msg, { tenantId: user.tenantId, intent: `cek_${type}` });
}

async function handleCatatHutangPiutang(user, parsed, accounts, rawText, intent) {
  const { tenantId } = user;
  const amount = parsed.entities.amount;
  if (!amount || amount <= 0) {
    const examples = {
      catat_hutang:  'catat hutang 500rb dari BCA',
      bayar_hutang:  'bayar hutang 200rb dari BCA',
      catat_piutang: 'catat piutang 300rb ke BCA',
      terima_piutang:'terima piutang 300rb ke BCA',
    };
    return reply(user.replyTo || user.whatsappNumber, `Nominal belum jelas.\n\nContoh:\n${examples[intent]}`, { tenantId, intent: 'clarify' });
  }

  const debtType = intent.includes('hutang') ? 'hutang' : 'piutang';
  const debtAccount = accounts.find((a) => a.type === debtType && a.status === 'active');
  if (!debtAccount) {
    return reply(user.replyTo || user.whatsappNumber, `Akun ${debtType} tidak ditemukan.`, { tenantId, intent: 'error' });
  }

  // Akun kas/bank sebagai pasangan (jika disebutkan, gunakan itu; kalau tidak, default/first)
  let cashAccount = null;
  if (parsed.entities.accountId) {
    cashAccount = accounts.find((a) => a.id === parsed.entities.accountId);
  }
  if (!cashAccount) cashAccount = accounts.find((a) => a.isDefault && a.status === 'active' && !['hutang', 'piutang'].includes(a.type));
  if (!cashAccount) cashAccount = accounts.find((a) => a.status === 'active' && !['hutang', 'piutang'].includes(a.type));
  if (!cashAccount) {
    return reply(user.replyTo || user.whatsappNumber, 'Tidak ada akun kas/bank aktif.', { tenantId, intent: 'error' });
  }

  // Tentukan arah transfer berdasarkan intent
  // catat_hutang:   hutang → kas (dapat uang hutang, kas naik, saldo hutang naik)
  // bayar_hutang:   kas → hutang (bayar hutang, kas turun, saldo hutang turun)
  // catat_piutang:  kas → piutang (pinjamkan uang, kas turun, saldo piutang naik)
  // terima_piutang: piutang → kas (terima uang kembali, kas naik, saldo piutang turun)
  let fromAccount, toAccount;
  if (intent === 'catat_hutang')   { fromAccount = debtAccount; toAccount = cashAccount; }
  if (intent === 'bayar_hutang')   { fromAccount = cashAccount; toAccount = debtAccount; }
  if (intent === 'catat_piutang')  { fromAccount = cashAccount; toAccount = debtAccount; }
  if (intent === 'terima_piutang') { fromAccount = debtAccount; toAccount = cashAccount; }

  const labelMap = {
    catat_hutang:   'Catat hutang',
    bayar_hutang:   'Bayar hutang',
    catat_piutang:  'Catat piutang',
    terima_piutang: 'Terima piutang',
  };
  const description = parsed.entities.description || `${labelMap[intent]} via ${cashAccount.name}`;
  const parsedWhen = parsed.entities.date ? new Date(`${parsed.entities.date}T00:00:00`) : null;
  const when = parsedWhen && !Number.isNaN(parsedWhen.getTime()) ? parsedWhen : new Date();

  const payload = {
    kind: 'transfer',
    fromAccountId: fromAccount.id,
    fromAccountName: fromAccount.name,
    toAccountId: toAccount.id,
    toAccountName: toAccount.name,
    amount,
    transactionDate: when.toISOString(),
    description,
  };

  const expiresMinutes = Number(process.env.WA_PENDING_EXPIRES_MINUTES || 10);
  await prisma.whatsappPendingTransaction.updateMany({ where: { userId: user.id, status: 'pending' }, data: { status: 'cancelled' } });
  await prisma.whatsappPendingTransaction.create({
    data: {
      tenantId,
      userId: user.id,
      whatsappNumber: user.replyTo || user.whatsappNumber,
      rawMessage: rawText,
      parsedPayload: payload,
      status: 'pending',
      expiresAt: new Date(Date.now() + expiresMinutes * 60 * 1000),
    },
  });

  const msg =
    `Konfirmasi ${labelMap[intent].toLowerCase()}:\n\n` +
    `Nominal: ${formatIDR(amount)}\n` +
    `Dari: ${fromAccount.name}\n` +
    `Ke: ${toAccount.name}\n` +
    `Tanggal: ${formatDateID(when)}\n` +
    `Keterangan: ${description}\n\n` +
    'Balas *YA* untuk simpan, atau *BATAL* untuk membatalkan.';

  return reply(user.replyTo || user.whatsappNumber, msg, { tenantId, intent, meta: payload });
}

async function handleCekTransaksi(user, parsed, type, categories) {
  const range = getPeriodRange(parsed.entities.period);
  const where = {
    tenantId: user.tenantId,
    status: 'active',
    type,
    transactionDate: { gte: range.from, lte: range.to },
    ...(parsed.entities.categoryId ? { categoryId: parsed.entities.categoryId } : {}),
  };

  const [agg, byCategory] = await Promise.all([
    prisma.transaction.aggregate({
      where,
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where,
      _sum: { amount: true },
    }),
  ]);

  const total = Number(agg._sum.amount || 0);
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const top = byCategory
    .map((g) => ({ name: catMap[g.categoryId] || 'Lainnya', total: Number(g._sum.amount || 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const label = type === 'income' ? 'Pemasukan' : 'Pengeluaran';
  const header = `${label} ${range.label}: ${formatIDR(total)}`;
  const topLines = top.length
    ? '\n\nKategori terbesar:\n' +
      top.map((t, i) => `${i + 1}. ${t.name}: ${formatIDR(t.total)}`).join('\n')
    : '';
  const count = `\nTransaksi: ${agg._count}`;

  const msg = header + count + topLines;
  return reply(user.replyTo || user.whatsappNumber, msg, {
    tenantId: user.tenantId,
    intent: type === 'income' ? 'cek_pemasukan' : 'cek_pengeluaran',
  });
}

function parseHistoryLimit(text) {
  const match = String(text || '').match(/\bterakhir\s+(\d{1,2})\b/i);
  if (!match) return 5;
  return Math.min(Math.max(Number(match[1]), 1), 10);
}

function transactionLabel(trx) {
  if (trx.type === 'income') return 'Masuk';
  if (trx.type === 'expense') return 'Keluar';
  return 'Adjustment';
}

async function handleRiwayatTransaksi(user, parsed, text) {
  const range = getPeriodRange(parsed.entities.period || 'today');
  const limit = parseHistoryLimit(text);
  const t = String(text || '').toLowerCase();
  const type = /\bpemasukan\b|\bmasuk\b|\bincome\b/.test(t)
    ? 'income'
    : /\bpengeluaran\b|\bkeluar\b|\bexpense\b/.test(t)
      ? 'expense'
      : null;

  const where = {
    tenantId: user.tenantId,
    status: 'active',
    transactionDate: { gte: range.from, lte: range.to },
    ...(type ? { type } : {}),
  };

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    include: {
      account: { select: { name: true } },
      category: { select: { name: true } },
      adjustment: { select: { difference: true, reason: true } },
    },
  });

  const titleType = type === 'income' ? ' pemasukan' : type === 'expense' ? ' pengeluaran' : '';
  if (!transactions.length) {
    return reply(
      user.replyTo || user.whatsappNumber,
      `Belum ada riwayat transaksi${titleType} ${range.label}.`,
      { tenantId: user.tenantId, intent: 'riwayat_transaksi' }
    );
  }

  const lines = transactions.map((trx, i) => {
    const amount = trx.type === 'adjustment'
      ? Number(trx.adjustment?.difference ?? trx.amount)
      : Number(trx.amount);
    const signedAmount = trx.type === 'expense' ? `-${formatIDR(amount)}` : formatIDR(amount);
    const category = trx.type === 'adjustment' ? 'Penyesuaian saldo' : (trx.category?.name || 'Tanpa kategori');
    const desc = trx.description ? `\n   ${trx.description}` : '';
    return `${i + 1}. ${transactionLabel(trx)} ${signedAmount} - ${category}\n   ${trx.account?.name || '-'}, ${formatDateID(trx.transactionDate)}${desc}`;
  });

  const msg = `Riwayat transaksi${titleType} ${range.label}:\n\n${lines.join('\n\n')}`;
  return reply(user.replyTo || user.whatsappNumber, msg, { tenantId: user.tenantId, intent: 'riwayat_transaksi' });
}

async function handleInputTransaksi(user, parsed, type, accounts, categories, rawText) {
  const amount = parsed.entities.amount;
  if (!amount || amount <= 0) {
    const msg =
      'Nominal belum jelas.\n\nContoh:\n' +
      (type === 'expense' ? 'keluar 50000 makan siang' : 'masuk 250000 jualan');
    return reply(user.replyTo || user.whatsappNumber, msg, { tenantId: user.tenantId, intent: 'clarify' });
  }

  // Pick account: mentioned > default > first active
  let account = null;
  if (parsed.entities.accountId) {
    account = accounts.find((a) => a.id === parsed.entities.accountId);
  }
  if (!account) account = accounts.find((a) => a.isDefault && a.status === 'active');
  if (!account) account = accounts.find((a) => a.status === 'active');
  if (!account) {
    return reply(
      user.replyTo || user.whatsappNumber,
      'Tidak ada akun aktif. Silakan buat akun di web terlebih dahulu.',
      { tenantId: user.tenantId, intent: 'error' }
    );
  }

  // Pick category
  let category = null;
  const catPool = categories.filter((c) => c.type === type && c.status === 'active');
  if (parsed.entities.categoryId) {
    category = catPool.find((c) => c.id === parsed.entities.categoryId);
  }
  if (!category) {
    category = catPool.find((c) => c.name.toLowerCase() === 'lainnya');
  }
  if (!category) category = catPool[0];

  const parsedWhen = parsed.entities.date ? new Date(`${parsed.entities.date}T00:00:00`) : null;
  const when = parsedWhen && !Number.isNaN(parsedWhen.getTime()) ? parsedWhen : new Date();
  const description =
    parsed.entities.description && parsed.entities.description.length > 2
      ? parsed.entities.description
      : rawText;

  const payload = {
    type,
    amount,
    accountId: account.id,
    accountName: account.name,
    categoryId: category?.id || null,
    categoryName: category?.name || null,
    transactionDate: when.toISOString(),
    description,
  };

  const expiresMinutes = Number(process.env.WA_PENDING_EXPIRES_MINUTES || 10);

  // Cancel existing pending
  await prisma.whatsappPendingTransaction.updateMany({
    where: { userId: user.id, status: 'pending' },
    data: { status: 'cancelled' },
  });

  await prisma.whatsappPendingTransaction.create({
    data: {
      tenantId: user.tenantId,
      userId: user.id,
      whatsappNumber: user.replyTo || user.whatsappNumber,
      rawMessage: rawText,
      parsedPayload: payload,
      status: 'pending',
      expiresAt: new Date(Date.now() + expiresMinutes * 60 * 1000),
    },
  });

  const kind = type === 'income' ? 'pemasukan' : 'pengeluaran';
  const msg =
    `Konfirmasi ${kind}:\n\n` +
    `Nominal: ${formatIDR(amount)}\n` +
    `Kategori: ${payload.categoryName || '-'}\n` +
    `Akun: ${payload.accountName}\n` +
    `Tanggal: ${formatDateID(when)}\n` +
    `Keterangan: ${description}\n\n` +
    'Balas *YA* untuk simpan, atau *BATAL* untuk membatalkan.';

  return reply(user.replyTo || user.whatsappNumber, msg, {
    tenantId: user.tenantId,
    intent: type === 'income' ? 'input_pemasukan' : 'input_pengeluaran',
    meta: payload,
  });
}

async function handleTransferAkun(user, parsed, accounts, rawText) {
  const amount = parsed.entities.amount;
  if (!amount || amount <= 0) {
    return reply(user.replyTo || user.whatsappNumber, 'Nominal transfer belum jelas. Contoh: transfer bank A ke kas 50rb', { tenantId: user.tenantId, intent: 'clarify' });
  }

  const from = accounts.find((a) => a.id === parsed.entities.fromAccountId || a.id === parsed.entities.accountId);
  const to = accounts.find((a) => a.id === parsed.entities.toAccountId);
  if (!from || !to) {
    if (parsed.entities.cashAccountCount > 1 && /tarik\s+tunai/i.test(rawText)) {
      const cashLines = accounts
        .filter((a) => a.name.toLowerCase() === 'kas' || a.type === 'cash')
        .map((a) => `- ${a.name}`)
        .join('\n');
      return reply(
        user.replyTo || user.whatsappNumber,
        `Akun kas tujuan belum jelas.\n\nSaya menemukan beberapa akun kas:\n${cashLines}\n\nKirim ulang dengan nama tujuan, contoh:\ntarik tunai ${from?.name || 'Bank A'} Kas C 50rb`,
        { tenantId: user.tenantId, intent: 'clarify' }
      );
    }
    const lines = accounts.map((a) => `- ${a.name}`).join('\n');
    return reply(
      user.replyTo || user.whatsappNumber,
      `Akun asal/tujuan belum jelas.\n\nContoh:\ntransfer Bank A ke Kas 50rb\n\nAkun aktif:\n${lines}`,
      { tenantId: user.tenantId, intent: 'clarify' }
    );
  }
  if (from.id === to.id) {
    return reply(user.replyTo || user.whatsappNumber, 'Akun asal dan tujuan tidak boleh sama.', { tenantId: user.tenantId, intent: 'clarify' });
  }

  const parsedWhen = parsed.entities.date ? new Date(`${parsed.entities.date}T00:00:00`) : null;
  const when = parsedWhen && !Number.isNaN(parsedWhen.getTime()) ? parsedWhen : new Date();
  let fallbackDescription = `Transfer ${from.name} ke ${to.name}`;
  if (/tarik\s+tunai/i.test(rawText)) fallbackDescription = `tarik tunai ${from.name}`;
  if (/setor\s+tunai/i.test(rawText)) fallbackDescription = `setor tunai ${to.name}`;
  const description = parsed.entities.description && parsed.entities.description.length > 2
    ? parsed.entities.description
    : fallbackDescription;

  const payload = {
    kind: 'transfer',
    fromAccountId: from.id,
    fromAccountName: from.name,
    toAccountId: to.id,
    toAccountName: to.name,
    amount,
    transactionDate: when.toISOString(),
    description,
  };

  const expiresMinutes = Number(process.env.WA_PENDING_EXPIRES_MINUTES || 10);
  await prisma.whatsappPendingTransaction.updateMany({
    where: { userId: user.id, status: 'pending' },
    data: { status: 'cancelled' },
  });
  await prisma.whatsappPendingTransaction.create({
    data: {
      tenantId: user.tenantId,
      userId: user.id,
      whatsappNumber: user.replyTo || user.whatsappNumber,
      rawMessage: rawText,
      parsedPayload: payload,
      status: 'pending',
      expiresAt: new Date(Date.now() + expiresMinutes * 60 * 1000),
    },
  });

  const msg =
    `Konfirmasi transfer:\n\n` +
    `Nominal: ${formatIDR(amount)}\n` +
    `Dari: ${from.name}\n` +
    `Ke: ${to.name}\n` +
    `Tanggal: ${formatDateID(when)}\n` +
    `Keterangan: ${description}\n\n` +
    'Balas *YA* untuk simpan, atau *BATAL* untuk membatalkan.';

  return reply(user.replyTo || user.whatsappNumber, msg, { tenantId: user.tenantId, intent: 'transfer_akun', meta: payload });
}

async function sendHelp(to, tenantId, unknown = false, tenantName = null, tenantType = null) {
  const header = unknown
    ? 'Saya tidak mengerti perintah tersebut. Coba salah satu:\n\n'
    : '';
  const contextLine = tenantName
    ? `Tenant aktif: *${tenantName}*${tenantType ? ` (${tenantType})` : ''}\nPindah tenant lewat web CatatIN.\n\n`
    : '';
  const msg =
    contextLine +
    header +
    'Keyword yang bisa dipakai:\n' +
    'help, bantuan, menu, perintah\n\n' +
    'Contoh command:\n\n' +
    '1. Cek saldo:\n' +
    'saldo\n' +
    'saldo bca\n\n' +
    '2. Cek pengeluaran:\n' +
    'pengeluaran hari ini\n' +
    'pengeluaran bulan ini\n\n' +
    '3. Cek pemasukan:\n' +
    'pemasukan hari ini\n' +
    'pemasukan bulan ini\n\n' +
    '4. Riwayat transaksi:\n' +
    'riwayat hari ini\n' +
    'riwayat bulan ini\n' +
    'transaksi terakhir 10\n' +
    'riwayat pengeluaran hari ini\n\n' +
    '5. Catat pengeluaran:\n' +
    'keluar 50000 makan siang\n' +
    'bayar 25rb parkir\n\n' +
    '6. Catat pemasukan:\n' +
    'masuk 250000 jualan\n' +
    'terima 1jt proyek\n\n' +
    '7. Transfer antar akun:\n' +
    'transfer Bank A ke Kas 50rb\n' +
    'transfer dari Bank A ke Kas 50rb\n' +
    'pindah 100rb Bank A Kas\n\n' +
    '8. Tarik / setor tunai:\n' +
    'tarik tunai Bank A 500rb\n' +
    'tarik tunai Bank A Kas C 500rb\n' +
    'setor tunai Bank A 500rb\n' +
    'setor tunai Kas C Bank A 500rb\n\n' +
    '9. Hutang & Piutang:\n' +
    'hutang / cek hutang\n' +
    'piutang / cek piutang\n' +
    'catat hutang 500rb dari BCA\n' +
    'bayar hutang 200rb dari BCA\n' +
    'catat piutang 300rb ke BCA\n' +
    'terima piutang 300rb ke BCA\n\n' +
    'Balasan cepat:\n' +
    'YA = simpan transaksi pending\n' +
    'BATAL = batalkan transaksi pending';
  return reply(to, msg, { tenantId, intent: 'help' });
}
