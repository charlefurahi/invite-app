// Turns spreadsheet rows (array of arrays) into guests. Pure function, no dependencies.
const clean = (v) => (v === null || v === undefined ? '' : typeof v === 'number' ? String(Math.round(v)) : String(v).trim());

function kind(h) {
  const s = clean(h).toLowerCase();
  if (!s || s.length > 30) return null; // long text is a title, not a column header
  if (/name|jina/.test(s)) return 'name';
  if (/mail|barua/.test(s)) return 'email';
  if (/phone|mobile|whatsapp|\btel|simu|cell|contact|number|namba/.test(s)) return 'phone';
  if (/guest|mgeni/.test(s)) return 'name';
  return null;
}

const isPhone = (v) => /^\+?\d[\d\s\-().]{6,}$/.test(clean(v));
const isMail = (v) => /\S+@\S+/.test(clean(v));
const hasLetters = (v) => /[a-z\u00C0-\u024f]/i.test(clean(v));

export function parseGuestRows(matrix) {
  const rows = (matrix || []).map((r) => (Array.isArray(r) ? r : [])).filter((r) => r.some((c) => clean(c)));
  if (!rows.length) return { guests: [], dupes: 0 };

  let cols = { name: -1, phone: -1, email: -1 };
  let start = 0;

  // 1) look for the header row in the first 5 rows: the one with the most recognised columns
  let bestScore = 0;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const c = { name: -1, phone: -1, email: -1 };
    rows[i].forEach((h, j) => { const k = kind(h); if (k && c[k] === -1) c[k] = j; });
    const score = (c.name !== -1) + (c.phone !== -1) + (c.email !== -1);
    const usable = c.name !== -1 || (i === 0 && score > 0);
    if (usable && score > bestScore) { bestScore = score; cols = c; start = i + 1; }
  }

  // 2) no header: work it out from what the columns contain
  if (start === 0) {
    const sample = rows.slice(0, 20);
    const width = Math.max(...rows.map((r) => r.length));
    let best = { phone: 0, email: 0 };
    for (let j = 0; j < width; j++) {
      const p = sample.filter((r) => isPhone(r[j])).length;
      const m = sample.filter((r) => isMail(r[j])).length;
      if (p > best.phone) { best.phone = p; cols.phone = j; }
      if (m > best.email) { best.email = m; cols.email = j; }
    }
  }

  // name column: first column that is not phone/email (prefer one containing letters)
  if (cols.name === -1) {
    const width = Math.max(...rows.map((r) => r.length));
    const free = [...Array(width).keys()].filter((j) => j !== cols.phone && j !== cols.email);
    cols.name = free.find((j) => rows.slice(start, start + 20).some((r) => hasLetters(r[j]))) ?? free[0] ?? 0;
  }

  const seen = new Set();
  const guests = [];
  let dupes = 0;
  for (const r of rows.slice(start)) {
    const name = clean(r[cols.name]);
    if (!name) continue;
    const phone = cols.phone >= 0 ? clean(r[cols.phone]) : '';
    let email = cols.email >= 0 ? clean(r[cols.email]) : '';
    if (email && !email.includes('@')) email = '';
    const key = `${name.toLowerCase()}|${phone}|${email.toLowerCase()}`;
    if (seen.has(key)) { dupes++; continue; }
    seen.add(key);
    guests.push({ name, phone: phone || null, email: email || null });
  }
  return { guests, dupes };
}
