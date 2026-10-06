const MONTHS = {
  januari: 0,
  jan: 0,
  februari: 1,
  feb: 1,
  maret: 2,
  mar: 2,
  april: 3,
  apr: 3,
  mei: 4,
  juni: 5,
  jun: 5,
  juli: 6,
  jul: 6,
  agustus: 7,
  agu: 7,
  agt: 7,
  september: 8,
  sep: 8,
  oktober: 9,
  okt: 9,
  november: 10,
  nov: 10,
  desember: 11,
  des: 11,
};

function atStartOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function validDate(year, month, day) {
  const d = new Date(year, month, day);
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) return null;
  return atStartOfDay(d);
}

export function parseIndonesianDate(text, now = new Date()) {
  const raw = String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const today = atStartOfDay(now);

  if (/\bhari\s*ini\b|\bhr\s*ini\b|\btoday\b/.test(raw)) {
    return { date: today, matchedText: 'hari ini', confidence: 'high' };
  }

  if (/\bkemarin\b|\bkmrn\b|\byesterday\b/.test(raw)) {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return { date: d, matchedText: 'kemarin', confidence: 'high' };
  }

  if (/\btadi\s+(pagi|siang|sore|malam)\b/.test(raw)) {
    return { date: today, matchedText: raw.match(/\btadi\s+(pagi|siang|sore|malam)\b/)[0], confidence: 'medium' };
  }

  // ISO-ish: 2026-05-10
  let m = raw.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (m) {
    const d = validDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (d) return { date: d, matchedText: m[0], confidence: 'high' };
  }

  // Numeric local: 10/05/2026 or 10-05-26
  m = raw.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]) - 1;
    let year = m[3] ? Number(m[3]) : today.getFullYear();
    if (year < 100) year += 2000;
    const d = validDate(year, month, day);
    if (d) return { date: d, matchedText: m[0], confidence: 'high' };
  }

  // tanggal 10, tgl 10 => current month/year
  m = raw.match(/\b(?:tanggal|tgl)\s+(\d{1,2})\b/);
  if (m) {
    const d = validDate(today.getFullYear(), today.getMonth(), Number(m[1]));
    if (d) return { date: d, matchedText: m[0], confidence: 'high' };
  }

  // 10 Mei / 10 Mei 2026
  m = raw.match(/\b(\d{1,2})\s+(januari|jan|februari|feb|maret|mar|april|apr|mei|juni|jun|juli|jul|agustus|agu|agt|september|sep|oktober|okt|november|nov|desember|des)(?:\s+(20\d{2}))?\b/);
  if (m) {
    const year = m[3] ? Number(m[3]) : today.getFullYear();
    const d = validDate(year, MONTHS[m[2]], Number(m[1]));
    if (d) return { date: d, matchedText: m[0], confidence: 'high' };
  }

  return null;
}
