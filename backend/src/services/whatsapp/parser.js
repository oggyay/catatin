/**
 * AI Command Parser
 * - Intent: cek_saldo, cek_pengeluaran, cek_pemasukan, riwayat_transaksi,
 *   input_pengeluaran, input_pemasukan, transfer_akun, konfirmasi, batal, help, unknown
 * - Entities: amount, account, category, date, description, period
 *
 * Strategy:
 *   1. Try local regex/heuristic parsing (fast, deterministic, Bahasa Indonesia friendly).
 *   2. If confidence is medium/low AND OPENAI_API_KEY is set, enhance with OpenAI.
 */

import OpenAI from 'openai';
import { parseIndonesianDate } from '../../utils/date-parser.js';

const INCOME_VERBS = ['masuk', 'pemasukan', 'pemasukn', 'msuk', 'terima', 'dapat', 'gajian', 'jual', 'jualan'];
const EXPENSE_VERBS = ['keluar', 'kluar', 'pengeluaran', 'pngeluaran', 'bayar', 'beli', 'belanja', 'catat pengeluaran'];
const TRANSFER_VERBS = ['transfer', 'tf', 'pindah', 'mindahin', 'mutasi', 'tarik tunai', 'setor tunai'];

const CONFIRM_WORDS = ['ya', 'y', 'ok', 'oke', 'iya', 'setuju', 'konfirm', 'konfirmasi'];
const CANCEL_WORDS = ['batal', 'cancel', 'tidak', 'ngga', 'nggak', 'gak', 'no', 'n'];
const HELP_WORDS = ['help', 'bantuan', 'menu', '/help', 'perintah'];

const DEBT_VERBS = ['catat hutang', 'hutang baru', 'tambah hutang'];
const DEBT_PAY_VERBS = ['bayar hutang', 'lunasi hutang', 'cicil hutang'];
const RECEIVABLE_VERBS = ['catat piutang', 'piutang baru', 'tambah piutang'];
const RECEIVABLE_COLLECT_VERBS = ['terima piutang', 'tagih piutang', 'piutang masuk', 'piutang diterima'];

function stripAccents(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalize(text) {
  return stripAccents(String(text || '').toLowerCase().trim()).replace(/\s+/g, ' ');
}

function toDateOnly(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseNominal(text) {
  const t = text.replace(/[.](?=\d{3}(?:\D|$))/g, '').replace(/,/g, '.');
  // pattern: "50 ribu", "50rb", "50k", "1 juta", "1jt", "2.5 juta", "250000"
  const patterns = [
    { re: /(\d+(?:\.\d+)?)\s*(?:juta|jt)/i, mult: 1_000_000 },
    { re: /(\d+(?:\.\d+)?)\s*(?:ribu|rb|k)\b/i, mult: 1_000 },
    { re: /\brp\s*([\d.]+)/i, mult: 1 },
    { re: /(?<![a-z])(\d{3,})(?![a-z])/i, mult: 1 },
  ];
  for (const p of patterns) {
    const m = t.match(p.re);
    if (m) {
      const num = parseFloat(m[1]);
      if (!isNaN(num)) return Math.round(num * p.mult);
    }
  }
  return null;
}

function detectPeriod(text) {
  const t = normalize(text);
  if (/\bhari ini\b|\bhr ini\b|\btoday\b/.test(t)) return 'today';
  if (/\bkemar(in|en)\b|\byesterday\b/.test(t)) return 'yesterday';
  if (/\bminggu ini\b/.test(t)) return 'this_week';
  if (/\bminggu lalu\b/.test(t)) return 'last_week';
  if (/\bbulan ini\b/.test(t)) return 'this_month';
  if (/\bbulan lalu\b/.test(t)) return 'last_month';
  if (/\btahun ini\b/.test(t)) return 'this_year';
  return null;
}

function detectIntent(text) {
  const t = normalize(text);

  if (CONFIRM_WORDS.includes(t)) return 'konfirmasi';
  if (CANCEL_WORDS.includes(t)) return 'batal';
  if (HELP_WORDS.some((w) => t === w || t.startsWith(w + ' '))) return 'help';

  // Cek hutang / piutang
  if (/\bcek hutang\b|\binfo hutang\b|\bberapa hutang\b|\bhutang saya\b|\bhutang ku\b/.test(t) || t === 'hutang') return 'cek_hutang';
  if (/\bcek piutang\b|\binfo piutang\b|\bberapa piutang\b|\bpiutang saya\b|\bpiutang ku\b/.test(t) || t === 'piutang') return 'cek_piutang';

  // Hutang/piutang dengan nominal
  const hasNominalEarly = parseNominal(t) !== null;
  if (hasNominalEarly) {
    if (DEBT_PAY_VERBS.some((v) => t.includes(v))) return 'bayar_hutang';
    if (DEBT_VERBS.some((v) => t.includes(v))) return 'catat_hutang';
    if (RECEIVABLE_COLLECT_VERBS.some((v) => t.includes(v))) return 'terima_piutang';
    if (RECEIVABLE_VERBS.some((v) => t.includes(v))) return 'catat_piutang';
  }

  // Cek saldo
  if (/\bsaldo\b|\bcek saldo\b|\bberapa saldo\b/.test(t)) return 'cek_saldo';

  if (/\briwayat\b|\bhistori\b|\bhistory\b|\bmutasi\b|\btransaksi terakhir\b|\bdaftar transaksi\b/.test(t)) {
    return 'riwayat_transaksi';
  }

  // Cek pengeluaran / pemasukan (tanpa nominal yang besar => hanya periode)
  const hasNominal = parseNominal(t) !== null;
  const hasTransfer = TRANSFER_VERBS.some((v) => t === v || t.startsWith(`${v} `));

  if (hasTransfer && hasNominal) return 'transfer_akun';

  if (/\bpengeluaran\b|\bpngeluaran\b|\buang keluar\b|\bspending\b/.test(t) && !hasNominal) {
    return 'cek_pengeluaran';
  }
  if (/\bpemasukan\b|\bpemasukn\b|\buang masuk\b|\bincome\b/.test(t) && !hasNominal) {
    return 'cek_pemasukan';
  }

  // Input transactions
  const hasExpense = EXPENSE_VERBS.some((v) => t.includes(v));
  const hasIncome = INCOME_VERBS.some((v) => t.includes(v));

  if (hasExpense && hasNominal) return 'input_pengeluaran';
  if (hasIncome && hasNominal) return 'input_pemasukan';

  // Just a nominal with unclear verb => likely expense (common case)
  if (hasNominal && (hasExpense || /\bbeli\b|\bbayar\b/.test(t))) return 'input_pengeluaran';

  return 'unknown';
}

function guessCategory(text, categories) {
  const t = normalize(text);
  let best = null;
  let bestLen = 0;
  for (const c of categories) {
    const name = normalize(c.name);
    if (!name) continue;
    if (t.includes(name) && name.length > bestLen) {
      best = c;
      bestLen = name.length;
    }
  }
  if (best) return best;
  // heuristics
  const mapping = {
    makan: 'Makan', jajan: 'Makan', kopi: 'Makan', warung: 'Makan',
    bensin: 'Transportasi', grab: 'Transportasi', gojek: 'Transportasi', ojek: 'Transportasi',
    belanja: 'Belanja', market: 'Belanja',
    listrik: 'Listrik', pln: 'Listrik',
    internet: 'Internet', wifi: 'Internet', indihome: 'Internet',
    sewa: 'Sewa', kontrakan: 'Sewa',
    gaji: 'Gaji', salary: 'Gaji',
    jualan: 'Penjualan', jual: 'Penjualan', penjualan: 'Penjualan',
    bonus: 'Bonus',
    modal: 'Modal',
  };
  for (const [k, v] of Object.entries(mapping)) {
    if (t.includes(k)) {
      const found = categories.find((c) => c.name.toLowerCase() === v.toLowerCase());
      if (found) return found;
    }
  }
  return null;
}

function guessAccount(text, accounts) {
  const t = normalize(text);
  let best = null;
  let bestLen = 0;
  for (const a of accounts) {
    const name = normalize(a.name);
    if (!name) continue;
    if (t.includes(name) && name.length > bestLen) {
      best = a;
      bestLen = name.length;
    }
  }
  return best;
}

function findMentionedAccounts(text, accounts) {
  const t = normalize(text);
  const matches = accounts
    .map((a) => ({ account: a, name: normalize(a.name), index: t.indexOf(normalize(a.name)) }))
    .filter((x) => x.name && x.index >= 0)
    .sort((a, b) => a.index - b.index || b.name.length - a.name.length);

  const selected = [];
  for (const match of matches) {
    const start = match.index;
    const end = match.index + match.name.length;
    const overlaps = selected.some((x) => start >= x.start && end <= x.end);
    if (!overlaps) selected.push({ ...match, start, end });
  }
  return selected.map((x) => x.account);
}

function findCashAccounts(accounts) {
  return accounts.filter((a) => normalize(a.name) === 'kas' || normalize(a.type) === 'cash');
}

function guessTransferAccounts(text, accounts) {
  const t = normalize(text);
  const mentioned = findMentionedAccounts(text, accounts);
  let fromAccount = null;
  let toAccount = null;
  const cashAccounts = findCashAccounts(accounts);
  const isTarikTunai = /\btarik\s+tunai\b/.test(t);
  const isSetorTunai = /\bsetor\s+tunai\b/.test(t);

  const fromMatch = t.match(/(?:dari|from)\s+(.+?)(?:\s+(?:ke|ke akun|menuju|to)\s+|$)/i);
  const toMatch = t.match(/(?:ke akun|ke|menuju|to)\s+(.+)$/i);
  if (fromMatch) fromAccount = guessAccount(fromMatch[1], accounts);
  if (toMatch) toAccount = guessAccount(toMatch[1], accounts);

  if (!fromAccount && mentioned.length >= 1) fromAccount = mentioned[0];
  if (!toAccount && mentioned.length >= 2) toAccount = mentioned.find((a) => a.id !== fromAccount?.id) || null;

  if (isTarikTunai && fromAccount && !toAccount && cashAccounts.length === 1 && cashAccounts[0].id !== fromAccount.id) {
    toAccount = cashAccounts[0];
  }

  if (isSetorTunai && !toAccount && mentioned.length >= 1) {
    toAccount = mentioned[0];
    if (!fromAccount && cashAccounts.length === 1 && cashAccounts[0].id !== toAccount.id) fromAccount = cashAccounts[0];
  }

  if (isSetorTunai && fromAccount && toAccount && fromAccount.id === toAccount.id && cashAccounts.length === 1 && cashAccounts[0].id !== toAccount.id) {
    fromAccount = cashAccounts[0];
  }

  return { fromAccount, toAccount, cashAccounts };
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function guessDescription(text, { accountName = null, categoryName = null } = {}) {
  let t = text;
  // remove common verbs and nominal tokens
  const stripList = [
    /keluar/gi, /kluar/gi, /pngeluaran/gi, /pengeluaran/gi, /catat/gi,
    /masuk/gi, /msuk/gi, /pemasukan/gi, /pemasukn/gi, /terima/gi,
    /hari ini/gi, /hr ini/gi, /kemarin/gi, /kmrn/gi, /minggu ini/gi, /bulan ini/gi,
    /tadi (pagi|siang|sore|malam)/gi,
    /tanggal\s+\d{1,2}/gi,
    /tgl\s+\d{1,2}/gi,
    /\d{1,2}\s+(januari|jan|februari|feb|maret|mar|april|apr|mei|juni|jun|juli|jul|agustus|agu|agt|september|sep|oktober|okt|november|nov|desember|des)(?:\s+20\d{2})?/gi,
    /\b20\d{2}-\d{1,2}-\d{1,2}\b/gi,
    /\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b/gi,
    /\brp\s*[\d.]+/gi,
    /\d+(?:\.\d+)?\s*(?:juta|jt|ribu|rb|k)\b/gi,
    /(?<![a-z])\d{3,}(?![a-z])/gi,
    /dari\s+kas/gi, /di\s+kas/gi,
  ];
  for (const re of stripList) t = t.replace(re, ' ');
  const accountNames = Array.isArray(accountName) ? accountName : [accountName].filter(Boolean);
  for (const name of accountNames) {
    const re = new RegExp(`\\b${escapeRegex(name)}\\b`, 'gi');
    t = t.replace(re, ' ');
  }
  if (categoryName) {
    const re = new RegExp(`\\b${escapeRegex(categoryName)}\\b`, 'gi');
    // keep category in description as it is often the meaningful part; only strip if duplicated
    const occurrences = (t.match(re) || []).length;
    if (occurrences > 1) t = t.replace(re, ' ').replace(new RegExp(`(?:^|\\s)${escapeRegex(categoryName)}(?=\\s|$)`, 'i'), ` ${categoryName} `);
  }
  t = t.replace(/\s+/g, ' ').trim();
  return t || null;
}

function heuristicParse(text, { accounts = [], categories = [] } = {}) {
  let intent = detectIntent(text);
  const amount = parseNominal(text);
  const period = detectPeriod(text);
  const parsedDate = parseIndonesianDate(text);

  let category = null;
  let account = null;
  let description = null;

  // Common shorthand: "makan 50rb kemarin" or "jualan 2jt tanggal 10".
  // If there is a nominal and a known category, infer transaction type from the category.
  if (intent === 'unknown' && amount) {
    const expenseCategory = guessCategory(text, categories.filter((c) => c.type === 'expense'));
    const incomeCategory = guessCategory(text, categories.filter((c) => c.type === 'income'));
    if (expenseCategory) {
      intent = 'input_pengeluaran';
      category = expenseCategory;
    } else if (incomeCategory) {
      intent = 'input_pemasukan';
      category = incomeCategory;
    }
  }

  if (['input_pengeluaran', 'input_pemasukan'].includes(intent)) {
    const type = intent === 'input_pengeluaran' ? 'expense' : 'income';
    const catPool = categories.filter((c) => c.type === type);
    category = category || guessCategory(text, catPool);
    account = guessAccount(text, accounts);
    description = guessDescription(text, { accountName: account?.name, categoryName: category?.name });
  }

  if (intent === 'transfer_akun') {
    const transfer = guessTransferAccounts(text, accounts);
    account = transfer.fromAccount;
    const toAccount = transfer.toAccount;
    description = guessDescription(text, { accountName: [account?.name, toAccount?.name].filter(Boolean) });
    const stripTransferWords = new RegExp(`\\b(${TRANSFER_VERBS.map(escapeRegex).join('|')})\\b`, 'gi');
    description = (description || text).replace(stripTransferWords, ' ').replace(/\b(dari|ke|menuju|from|to)\b/gi, ' ').replace(/\s+/g, ' ').trim() || null;

    return {
      intent,
      entities: {
        amount,
        period,
        accountId: account?.id || null,
        accountName: account?.name || null,
        fromAccountId: account?.id || null,
        fromAccountName: account?.name || null,
        toAccountId: toAccount?.id || null,
        toAccountName: toAccount?.name || null,
        cashAccountCount: transfer.cashAccounts?.length || 0,
        categoryId: null,
        categoryName: null,
        description,
        date: parsedDate ? toDateOnly(parsedDate.date) : null,
        dateText: parsedDate?.matchedText || null,
      },
      confidence: amount && account && toAccount && account.id !== toAccount.id ? 'high' : amount ? 'medium' : 'low',
      source: 'heuristic',
    };
  }

  if (['cek_pengeluaran', 'cek_pemasukan', 'riwayat_transaksi'].includes(intent)) {
    const type = intent === 'cek_pengeluaran' ? 'expense' : 'income';
    if (intent !== 'riwayat_transaksi') {
      const catPool = categories.filter((c) => c.type === type);
      category = guessCategory(text, catPool);
    }
  }

  // Hutang/piutang — cari akun kas/bank sebagai pasangan
  if (['catat_hutang', 'bayar_hutang', 'catat_piutang', 'terima_piutang'].includes(intent)) {
    account = guessAccount(text, accounts.filter((a) => !['hutang', 'piutang'].includes(a.type)));
    description = guessDescription(text, { accountName: account?.name });
    return {
      intent,
      entities: {
        amount,
        period,
        accountId: account?.id || null,
        accountName: account?.name || null,
        categoryId: null,
        categoryName: null,
        description,
        date: parsedDate ? toDateOnly(parsedDate.date) : null,
        dateText: parsedDate?.matchedText || null,
      },
      confidence: amount ? 'high' : 'medium',
      source: 'heuristic',
    };
  }

  let confidence = 'low';
  if (intent === 'konfirmasi' || intent === 'batal' || intent === 'help') confidence = 'high';
  else if (intent === 'cek_saldo') confidence = 'high';
  else if (intent === 'riwayat_transaksi') confidence = 'high';
  else if (intent.startsWith('cek_')) confidence = period ? 'high' : 'medium';
  else if (intent.startsWith('input_')) {
    confidence = amount && category ? 'high' : amount ? 'medium' : 'low';
  }

  return {
    intent,
    entities: {
      amount,
      period,
      accountId: account?.id || null,
      accountName: account?.name || null,
      categoryId: category?.id || null,
      categoryName: category?.name || null,
      description,
      date: parsedDate ? toDateOnly(parsedDate.date) : null,
      dateText: parsedDate?.matchedText || null,
    },
    confidence,
    source: 'heuristic',
  };
}

async function enhanceWithOpenAI(text, baseResult, { accounts, categories }) {
  if (process.env.AI_PARSER_ENABLED !== 'true') return baseResult;
  if (!process.env.OPENAI_API_KEY) return baseResult;

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const sys = `Anda adalah parser command WhatsApp untuk aplikasi keuangan berbahasa Indonesia.
Keluarkan JSON valid dengan struktur:
{
  "intent": "cek_saldo|cek_pengeluaran|cek_pemasukan|riwayat_transaksi|input_pengeluaran|input_pemasukan|transfer_akun|konfirmasi|batal|help|unknown",
  "amount": number|null,
  "date": "YYYY-MM-DD|null",
  "period": "today|yesterday|this_week|last_week|this_month|last_month|this_year|null",
  "accountName": string|null,
  "fromAccountName": string|null,
  "toAccountName": string|null,
  "categoryName": string|null,
  "description": string|null,
  "confidence": "high|medium|low"
}
Perhatikan typo dan variasi nominal (50rb=50000, 1jt=1000000, 2,5 juta=2500000).`;

    const userPrompt = `Pesan user: "${text}"
Akun tersedia: ${accounts.map((a) => a.name).join(', ') || '-'}
Kategori tersedia: ${categories.map((c) => `${c.name}(${c.type})`).join(', ') || '-'}`;

    const resp = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    });

    const raw = resp.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);

    const catPool = parsed.intent?.includes('pengeluaran')
      ? categories.filter((c) => c.type === 'expense')
      : parsed.intent?.includes('pemasukan')
        ? categories.filter((c) => c.type === 'income')
        : categories;

    const matchCat = parsed.categoryName
      ? catPool.find((c) => c.name.toLowerCase() === String(parsed.categoryName).toLowerCase())
      : null;
    const matchAcc = parsed.accountName
      ? accounts.find((a) => a.name.toLowerCase() === String(parsed.accountName).toLowerCase())
      : null;
    const matchFromAcc = parsed.fromAccountName
      ? accounts.find((a) => a.name.toLowerCase() === String(parsed.fromAccountName).toLowerCase())
      : null;
    const matchToAcc = parsed.toAccountName
      ? accounts.find((a) => a.name.toLowerCase() === String(parsed.toAccountName).toLowerCase())
      : null;

    return {
      intent: parsed.intent || baseResult.intent,
      entities: {
        amount: parsed.amount ?? baseResult.entities.amount,
        // Local date parsing is deterministic; don't let AI override it with hallucinated dates.
        date: baseResult.entities.date || parsed.date || null,
        period: parsed.period ?? baseResult.entities.period,
        accountId: matchAcc?.id || baseResult.entities.accountId,
        accountName: matchAcc?.name || parsed.accountName || baseResult.entities.accountName,
        fromAccountId: matchFromAcc?.id || baseResult.entities.fromAccountId || null,
        fromAccountName: matchFromAcc?.name || parsed.fromAccountName || baseResult.entities.fromAccountName || null,
        toAccountId: matchToAcc?.id || baseResult.entities.toAccountId || null,
        toAccountName: matchToAcc?.name || parsed.toAccountName || baseResult.entities.toAccountName || null,
        categoryId: matchCat?.id || baseResult.entities.categoryId,
        categoryName: matchCat?.name || parsed.categoryName || baseResult.entities.categoryName,
        description: parsed.description || baseResult.entities.description,
        dateText: baseResult.entities.dateText,
      },
      confidence: parsed.confidence || baseResult.confidence,
      source: 'openai',
    };
  } catch (e) {
    console.warn('[AI parser] fallback ke heuristic:', e.message);
    return baseResult;
  }
}

export async function parseCommand(text, context = {}) {
  const base = heuristicParse(text, context);
  if (base.confidence === 'high') return base;
  return enhanceWithOpenAI(text, base, context);
}

export const __test = { parseNominal, detectIntent, detectPeriod, heuristicParse };
