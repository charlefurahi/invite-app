import { useEffect, useState } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import { supabase, api, envOk, waNumber } from './api.js';
import Invite from './Invite.jsx';
import { parseGuestRows } from './importGuests.js';
import CheckIn from './CheckIn.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/i/:token" element={<Invite />} />
      <Route path="/admin" element={<Admin><Dashboard /></Admin>} />
      <Route path="/admin/checkin/:id" element={<Admin><CheckIn /></Admin>} />
      <Route path="*" element={<Navigate to="/admin" />} />
    </Routes>
  );
}

function Notice({ n }) {
  return n ? <p className={n.bad ? 'warn' : 'ok'}>{n.t}</p> : null;
}

function Admin({ children }) {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (!envOk) {
    return (
      <div className="wrap"><div className="card">
        <h2>Setup needed</h2>
        <p>frontend/.env is missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Fill them in, stop Vite (Ctrl+C) and run npm run dev again.</p>
      </div></div>
    );
  }
  if (session === undefined) return <div className="wrap">Loading…</div>;
  return session ? children : <Login />;
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [n, setN] = useState(null);
  const [busy, setBusy] = useState(false);

  const go = async (signup) => {
    if (!email.trim() || password.length < 6) return setN({ bad: true, t: 'Enter an email and a password of at least 6 characters.' });
    setBusy(true);
    const creds = { email: email.trim(), password };
    const { data, error } = signup ? await supabase.auth.signUp(creds) : await supabase.auth.signInWithPassword(creds);
    setBusy(false);
    if (error) return setN({ bad: true, t: error.message });
    if (signup && !data.session) setN({ t: 'Account created. Check your email to confirm it, then sign in.' });
  };

  return (
    <div className="wrap">
      <form className="card" onSubmit={(e) => { e.preventDefault(); go(false); }}>
        <h2>Host login</h2>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="Password (min 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="row">
          <button type="submit" disabled={busy}>Sign in</button>
          <button type="button" className="alt" disabled={busy} onClick={() => go(true)}>Sign up</button>
        </div>
        <Notice n={n} />
      </form>
    </div>
  );
}

const THEMES = ['classic', 'floral', 'modern', 'dark'];
const EMPTY = { title: '', host_names: '', event_date: '', venue: '', map_url: '', dress_code: '', message: '', theme: 'classic', schedule: '' };

function Dashboard() {
  const [events, setEvents] = useState(null);
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [n, setN] = useState(null);
  const [fn, setFn] = useState(null); // message shown next to the Create button
  const [busy, setBusy] = useState(false);

  const load = () => api('/api/events', { authed: true }).then(setEvents).catch((e) => { setEvents([]); setN({ bad: true, t: e.message }); });
  useEffect(() => { load(); }, []);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const create = async () => {
    setFn(null);
    if (!form.title.trim()) return setFn({ bad: true, t: 'Please enter an event title.' });
    setBusy(true);
    try {
      const schedule = form.schedule.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
        const [time, ...rest] = l.split('|');
        return { time: time.trim(), title: rest.join('|').trim() };
      });
      const body = { ...form, schedule, event_date: form.event_date ? new Date(form.event_date).toISOString() : null };
      const ev = await api('/api/events', { method: 'POST', authed: true, body });
      setForm(EMPTY);
      setN({ t: `Event "${ev.title}" created. Add your guests below.` });
      await load();
      setSel(ev);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { setFn({ bad: true, t: e.message }); }
    setBusy(false);
  };

  return (
    <div className="wrap">
      <div className="row" style={{ alignItems: 'center' }}>
        <h2>My events</h2>
        <button className="alt" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
      <Notice n={n} />
      {events === null && <p>Loading…</p>}
      {events && events.length === 0 && <p className="muted">No events yet. Create your first one below.</p>}
      {(events || []).map((e) => (
        <div key={e.id} className={`card pick ${sel && sel.id === e.id ? 'sel' : ''}`} onClick={() => setSel(e)}>
          <b>{e.title}</b>
          <div className="muted">{e.event_date ? new Date(e.event_date).toLocaleString() : 'No date set'}{e.venue ? ` · ${e.venue}` : ''}</div>
        </div>
      ))}
      {sel && <Guests key={sel.id} event={sel} />}

      <div className="card">
        <h3>New event</h3>
        <input placeholder="Title (e.g. John & Mary's Wedding) *" value={form.title} onChange={set('title')} />
        <input placeholder="Hosts" value={form.host_names} onChange={set('host_names')} />
        <input type="datetime-local" value={form.event_date} onChange={set('event_date')} />
        <input placeholder="Venue" value={form.venue} onChange={set('venue')} />
        <input placeholder="Google Maps link" value={form.map_url} onChange={set('map_url')} />
        <input placeholder="Dress code" value={form.dress_code} onChange={set('dress_code')} />
        <textarea placeholder="Message to guests" value={form.message} onChange={set('message')} />
        <select value={form.theme} onChange={set('theme')}>{THEMES.map((t) => <option key={t}>{t}</option>)}</select>
        <textarea rows="3" placeholder={'Programme, one per line: 2:00 PM | Ceremony'} value={form.schedule} onChange={set('schedule')} />
        <button disabled={busy} onClick={create}>{busy ? 'Creating…' : 'Create event'}</button>
        <Notice n={fn} />
      </div>
    </div>
  );
}

function Guests({ event }) {
  const [guests, setGuests] = useState(null);
  const [names, setNames] = useState('');
  const [photos, setPhotos] = useState(event.photos || []);
  const [theme, setTheme] = useState(event.theme || 'classic');
  const [n, setN] = useState(null);
  const [remind, setRemind] = useState(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const load = (silent) => api(`/api/events/${event.id}/guests`, { authed: true })
    .then(setGuests)
    .catch((e) => { if (!silent) { setGuests([]); setN({ bad: true, t: e.message }); } });

  // refresh every 15s so new RSVPs appear without reloading
  useEffect(() => {
    load(false);
    const t = setInterval(() => load(true), 15000);
    return () => clearInterval(t);
  }, [event.id]);

  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      const r = await fn();
      if (okMsg) setN({ t: typeof okMsg === 'function' ? okMsg(r) : okMsg });
      await load(true);
    } catch (e) { setN({ bad: true, t: e.message }); }
    setBusy(false);
  };

  const add = () => {
    const list = names.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!list.length) return setN({ bad: true, t: 'Type at least one guest name.' });
    run(async () => {
      await api(`/api/events/${event.id}/guests`, { method: 'POST', authed: true, body: { names: list } });
      setNames('');
      return list.length;
    }, (c) => `Added ${c} guest(s).`);
  };

  const template = () => {
    const csv = 'name,phone,email\nJohn & Family,0712345678,john@example.com\nMary,255755123456,\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'guest-list-template.csv';
    a.click();
  };

  const importFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let parsed;
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
      const sheetName = wb.SheetNames.find((s) => wb.Sheets[s]['!ref']) || wb.SheetNames[0];
      const matrix = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
      parsed = parseGuestRows(matrix);
    } catch (err) {
      return setN({ bad: true, t: `Could not read "${file.name}" (${err.message}). Close it in Excel first, and make sure it is .xlsx, .xls or .csv and not password protected.` });
    }
    const have = new Set((guests || []).map((g) => g.name.toLowerCase()));
    const list = parsed.guests.filter((g) => !have.has(g.name.toLowerCase()));
    const already = parsed.guests.length - list.length;
    if (!list.length) {
      return setN({ bad: true, t: parsed.guests.length ? `All ${already} guests in the file are already on your list.` : 'No guest names found in the file. Put the names in the first column, or use the headers: name, phone, email.' });
    }
    run(async () => {
      for (let i = 0; i < list.length; i += 200) {
        await api(`/api/events/${event.id}/guests`, { method: 'POST', authed: true, body: { guests: list.slice(i, i + 200) } });
      }
      const extra = [already && `${already} already on the list`, parsed.dupes && `${parsed.dupes} repeated rows`].filter(Boolean).join(', ');
      return `Imported ${list.length} guest(s)${extra ? ` (skipped ${extra})` : ''}.`;
    }, (m) => m);
  };

  const remove = (g) => {
    if (!confirm(`Remove ${g.name} from the guest list?`)) return;
    run(() => api(`/api/events/${event.id}/guests/${g.id}`, { method: 'DELETE', authed: true }), `${g.name} removed.`);
  };

  const doRemind = () => run(async () => { setRemind(await api(`/api/events/${event.id}/remind`, { method: 'POST', authed: true })); });

  const changeTheme = (t) => {
    setTheme(t);
    run(() => api(`/api/events/${event.id}`, { method: 'PATCH', authed: true, body: { theme: t } }), 'Theme updated.');
  };

  const upload = async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    const urls = [];
    let failed = 0;
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) { failed++; continue; }
      const path = `${event.id}/${Date.now()}-${file.name.replace(/[^\w.]/g, '_')}`;
      const { error } = await supabase.storage.from('event-photos').upload(path, file);
      if (error) failed++;
      else urls.push(supabase.storage.from('event-photos').getPublicUrl(path).data.publicUrl);
    }
    try {
      if (urls.length) {
        const next = [...photos, ...urls];
        await api(`/api/events/${event.id}`, { method: 'PATCH', authed: true, body: { photos: next } });
        setPhotos(next);
      }
      setN({ bad: failed > 0, t: `${urls.length} photo(s) uploaded${failed ? `, ${failed} failed (max 5 MB each, and migration_2.sql must have run)` : ''}.` });
    } catch (err) { setN({ bad: true, t: err.message }); }
    setBusy(false);
  };

  const removePhoto = (u) => {
    if (!confirm('Remove this photo from the invitation?')) return;
    const next = photos.filter((p) => p !== u);
    run(async () => {
      await api(`/api/events/${event.id}`, { method: 'PATCH', authed: true, body: { photos: next } });
      setPhotos(next);
    }, 'Photo removed.');
  };

  const link = (g) => `${location.origin}/i/${g.token}`;
  const wa = (g) => `https://wa.me/${waNumber(g.phone)}?text=${encodeURIComponent(`Hi ${g.name}, you're invited to ${event.title}! RSVP here: ${link(g)}`)}`;
  const copy = async (g) => {
    try { await navigator.clipboard.writeText(link(g)); setN({ t: `Link for ${g.name} copied.` }); }
    catch { setN({ bad: true, t: `Copy failed. Link: ${link(g)}` }); }
  };

  const exportCsv = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['name', 'phone', 'email', 'status', 'party_size', 'meal', 'note', 'opened', 'checked_in'];
    const rows = (guests || []).map((g) => [g.name, g.phone, g.email, g.status, g.party_size, g.meal, g.note, g.opened_at ? 'yes' : '', g.checked_in_at ? 'yes' : '']);
    const csv = [head, ...rows].map((r) => r.map(esc).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `${event.title.replace(/[^\w]+/g, '_')}_guests.csv`;
    a.click();
  };

  const list = guests || [];
  const shown = list.filter((g) => g.name.toLowerCase().includes(q.toLowerCase()));
  const yes = list.filter((g) => g.status === 'yes');
  const headcount = yes.reduce((s, g) => s + (g.party_size || 1), 0);

  return (
    <div className="card">
      <h3>{event.title}</h3>
      <p>
        {list.length} invited · {list.filter((g) => g.opened_at).length} opened · {yes.length} yes ({headcount} people) ·{' '}
        {list.filter((g) => g.status === 'no').length} no · {list.filter((g) => g.status === 'maybe').length} maybe
      </p>
      <Notice n={n} />
      <div className="row">
        <select value={theme} disabled={busy} onChange={(e) => changeTheme(e.target.value)}>{THEMES.map((t) => <option key={t}>{t}</option>)}</select>
        <button disabled={busy} onClick={doRemind}>Remind pending</button>
        <button className="alt" disabled={!list.length} onClick={exportCsv}>Export CSV</button>
        <Link to={`/admin/checkin/${event.id}`}><button>Check-in mode</button></Link>
      </div>
      {remind && (
        <div className="ok">
          {remind.pending === 0 ? 'Everyone has replied.' : `${remind.pending} pending · ${remind.emailed} emailed`}
          {remind.whatsapp.map((w) => <div key={w.url}><a href={w.url} target="_blank" rel="noreferrer">WhatsApp {w.name}</a></div>)}
        </div>
      )}

      <textarea rows="3" placeholder="Add guests, one name per line" value={names} onChange={(e) => setNames(e.target.value)} />
      <div className="row">
        <button disabled={busy} onClick={add}>Add guests</button>
        <label className="muted">Import Excel/CSV (columns: name, phone, email)
          <input type="file" disabled={busy} accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={importFile} />
        </label>
        <button className="alt sm" onClick={template}>Download template</button>
      </div>

      {guests === null ? <p>Loading guests…</p> : (
        <>
          {list.length > 5 && <input placeholder="Search guests…" value={q} onChange={(e) => setQ(e.target.value)} />}
          {list.length === 0 && <p className="muted">No guests yet. Add some above.</p>}
          {list.length > 0 && (
            <div className="tablewrap">
              <table>
                <thead><tr><th>Name</th><th>Status</th><th>Opened</th><th>In</th><th>Share</th></tr></thead>
                <tbody>
                  {shown.map((g) => (
                    <tr key={g.id}>
                      <td>{g.name}</td>
                      <td>{g.status}{g.status === 'yes' ? ` (${g.party_size})` : ''}</td>
                      <td>{g.opened_at ? '✓' : '–'}</td>
                      <td>{g.checked_in_at ? '✓' : '–'}</td>
                      <td>
                        <a href={wa(g)} target="_blank" rel="noreferrer">WhatsApp</a>{' '}
                        <button className="alt sm" onClick={() => copy(g)}>Copy</button>{' '}
                        <button className="alt sm" onClick={() => remove(g)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <h4>Gallery photos</h4>
      <input type="file" accept="image/*" multiple disabled={busy} onChange={upload} />
      <p className="muted">Max 5 MB each. Click a photo to remove it.</p>
      <div className="gallery">{photos.map((u) => <img key={u} src={u} alt="" onClick={() => removePhoto(u)} style={{ cursor: 'pointer' }} />)}</div>
    </div>
  );
}
