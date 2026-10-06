import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { api } from './api.js';

export default function CheckIn() {
  const { id } = useParams();
  const [guests, setGuests] = useState([]);
  const [msg, setMsg] = useState(null);
  const [q, setQ] = useState('');
  const last = useRef('');

  const load = () => api(`/api/events/${id}/guests`, { authed: true }).then(setGuests).catch((e) => setMsg({ bad: true, t: e.message }));
  useEffect(() => { load(); }, [id]);

  const checkin = async (token) => {
    try {
      const r = await api(`/api/events/${id}/checkin`, { method: 'POST', authed: true, body: { token } });
      setMsg({ bad: r.already || r.status === 'no', t: r.already ? `${r.name} already checked in` : r.status === 'no' ? `${r.name} declined but was checked in` : `Welcome ${r.name} (${r.party_size || 1})` });
      load();
    } catch (e) { setMsg({ bad: true, t: e.message }); }
  };
  const checkinRef = useRef(checkin); checkinRef.current = checkin;

  useEffect(() => {
    const s = new Html5Qrcode('reader');
    s.start({ facingMode: 'environment' }, { fps: 10, qrbox: 220 }, (text) => {
      const token = text.split('/i/')[1];
      if (!token || token === last.current) return;
      last.current = token; setTimeout(() => (last.current = ''), 3000);
      checkinRef.current(token);
    }).catch(() => setMsg({ bad: true, t: 'Camera unavailable. Use the list below.' }));
    return () => { if (s.isScanning) s.stop().catch(() => {}); };
  }, []);

  const expected = guests.filter((g) => g.status === 'yes');
  const inCount = guests.filter((g) => g.checked_in_at).reduce((n, g) => n + (g.checked_in_count || 1), 0);
  const shown = guests.filter((g) => g.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="wrap">
      <Link to="/admin">← Back</Link>
      <h2>Check-in</h2>
      <p>{inCount} people in · {expected.reduce((n, g) => n + (g.party_size || 1), 0)} expected</p>
      <div id="reader" />
      {msg && <p className={msg.bad ? 'warn' : 'ok'}>{msg.t}</p>}
      <input placeholder="Search guest…" value={q} onChange={(e) => setQ(e.target.value)} />
      <table><tbody>
        {shown.map((g) => (
          <tr key={g.id}><td>{g.name}</td><td>{g.status}</td>
            <td>{g.checked_in_at ? '✓ in' : <button onClick={() => checkin(g.token)}>Check in</button>}</td></tr>
        ))}
      </tbody></table>
    </div>
  );
}
