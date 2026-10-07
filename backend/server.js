import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const app = express();
// FRONTEND_URL may hold several comma-separated URLs; spaces and trailing slashes are ignored
const origins = (process.env.FRONTEND_URL || '').split(',').map((u) => u.trim().replace(/\/+$/, '')).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true }));
app.set('trust proxy', 1);
app.use(express.json({ limit: '200kb' }));

// light abuse protection on the public guest endpoints: 60 requests/minute per IP
const hits = new Map();
setInterval(() => hits.clear(), 60_000).unref();
app.use('/api/invite', (req, res, next) => {
  const n = (hits.get(req.ip) || 0) + 1;
  hits.set(req.ip, n);
  if (n > 60) return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  next();
});

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => res.status(500).json({ error: e.message }));

async function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: 'Unauthorized' });
  req.user = data.user;
  next();
}

async function ownEvent(req, res, next) {
  const { data } = await sb.from('events').select('*').eq('id', req.params.id).eq('owner_id', req.user.id).single();
  if (!data) return res.status(404).json({ error: 'Event not found' });
  req.event = data;
  next();
}

app.get('/health', (_, res) => res.send('ok'));

// ---------- Host (authenticated) ----------
app.get('/api/events', auth, wrap(async (req, res) => {
  const { data, error } = await sb.from('events').select('*').eq('owner_id', req.user.id).order('created_at', { ascending: false });
  if (error) throw error;
  res.json(data);
}));

app.post('/api/events', auth, wrap(async (req, res) => {
  const { title, host_names, event_date, venue, map_url, dress_code, message, theme, schedule } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const { data, error } = await sb.from('events')
    .insert({ owner_id: req.user.id, title, host_names, event_date: event_date || null, venue, map_url, dress_code, message, theme: theme || 'classic', schedule: schedule || [] })
    .select().single();
  if (error) throw error;
  res.json(data);
}));

app.get('/api/events/:id/guests', auth, ownEvent, wrap(async (req, res) => {
  const { data, error } = await sb.from('guests').select('*').eq('event_id', req.event.id).order('created_at');
  if (error) throw error;
  res.json(data);
}));

// body: { names: ["John & Family", "Mary"] }
app.post('/api/events/:id/guests', auth, ownEvent, wrap(async (req, res) => {
  const list = (req.body.guests || (req.body.names || []).map((name) => ({ name }))).filter((g) => g && String(g.name || '').trim());
  const clean = (v) => (v ? String(v).trim() : null);
  const rows = list.slice(0, 500).map((g) => ({
    event_id: req.event.id, name: String(g.name).trim(), phone: clean(g.phone), email: clean(g.email),
    token: crypto.randomBytes(6).toString('hex'),
  }));
  const { data, error } = await sb.from('guests').insert(rows).select();
  if (error) throw error;
  res.json(data);
}));

app.delete('/api/events/:id/guests/:gid', auth, ownEvent, wrap(async (req, res) => {
  await sb.from('guests').delete().eq('id', req.params.gid).eq('event_id', req.event.id);
  res.json({ ok: true });
}));

// ---------- Guest (public, by token) ----------
app.get('/api/invite/:token', wrap(async (req, res) => {
  const { data: guest } = await sb.from('guests').select('*').eq('token', req.params.token).single();
  if (!guest) return res.status(404).json({ error: 'Invitation not found' });
  if (!guest.opened_at) await sb.from('guests').update({ opened_at: new Date().toISOString() }).eq('id', guest.id);
  const { data: event } = await sb.from('events').select('title,host_names,event_date,venue,map_url,dress_code,message,theme,schedule,photos').eq('id', guest.event_id).single();
  const { token, event_id, id, ...safe } = guest;
  res.json({ guest: safe, event });
}));

app.post('/api/invite/:token/rsvp', wrap(async (req, res) => {
  const { status, party_size, meal, note } = req.body;
  if (!['yes', 'no', 'maybe'].includes(status)) return res.status(400).json({ error: 'invalid status' });
  const { data, error } = await sb.from('guests')
    .update({ status, party_size: Math.max(1, Math.min(20, +party_size || 1)), meal, note, responded_at: new Date().toISOString() })
    .eq('token', req.params.token).select().single();
  if (error || !data) return res.status(404).json({ error: 'Invitation not found' });
  res.json({ ok: true });
}));

app.patch('/api/events/:id', auth, ownEvent, wrap(async (req, res) => {
  const allowed = ['title', 'host_names', 'event_date', 'venue', 'map_url', 'dress_code', 'message', 'theme', 'schedule', 'photos'];
  const patch = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  const { data, error } = await sb.from('events').update(patch).eq('id', req.event.id).select().single();
  if (error) throw error;
  res.json(data);
}));

// QR / manual check-in. body: { token, count? }
app.post('/api/events/:id/checkin', auth, ownEvent, wrap(async (req, res) => {
  const { data: g } = await sb.from('guests').select('*').eq('token', req.body.token).eq('event_id', req.event.id).single();
  if (!g) return res.status(404).json({ error: 'Guest not found for this event' });
  const already = !!g.checked_in_at;
  const count = Math.max(1, +req.body.count || g.party_size || 1);
  if (!already) await sb.from('guests').update({ checked_in_at: new Date().toISOString(), checked_in_count: count }).eq('id', g.id);
  res.json({ name: g.name, status: g.status, party_size: g.party_size, already });
}));

// Remind guests who haven't replied: emails via Resend (if configured) + WhatsApp links for the rest
app.post('/api/events/:id/remind', auth, ownEvent, wrap(async (req, res) => {
  const base = (process.env.FRONTEND_URL || '').split(',')[0];
  const { data: pending } = await sb.from('guests').select('*').eq('event_id', req.event.id).eq('status', 'pending');
  let emailed = 0;
  const whatsapp = [];
  for (const g of pending || []) {
    const url = `${base}/i/${g.token}`;
    const text = `Hi ${g.name}, a gentle reminder to RSVP for ${req.event.title}: ${url}`;
    if (g.email && process.env.RESEND_API_KEY) {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: process.env.EMAIL_FROM || 'onboarding@resend.dev', to: g.email, subject: `Reminder: ${req.event.title}`, text }),
      });
      if (r.ok) { emailed++; continue; }
    }
    let phone = (g.phone || '').replace(/\D/g, '');
    const cc = process.env.DEFAULT_COUNTRY_CODE || '255';
    if (phone.startsWith('00')) phone = phone.slice(2);
    else if (phone.startsWith('0')) phone = cc + phone.slice(1);
    else if (phone && phone.length <= 9 && !phone.startsWith(cc)) phone = cc + phone;
    whatsapp.push({ name: g.name, url: `https://wa.me/${phone}?text=${encodeURIComponent(text)}` });
  }
  res.json({ pending: (pending || []).length, emailed, whatsapp });
}));

app.listen(process.env.PORT || 3000, () => console.log('API running'));
