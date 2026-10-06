import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api } from './api.js';

export default function Invite() {
  const { token } = useParams();
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [f, setF] = useState({ status: 'yes', party_size: 1, meal: '', note: '' });
  const [done, setDone] = useState(false);

  useEffect(() => {
    api(`/api/invite/${token}`).then((x) => {
      setD(x);
      document.title = x.event.title;
      if (x.guest.status !== 'pending') setF({ status: x.guest.status, party_size: x.guest.party_size || 1, meal: x.guest.meal || '', note: x.guest.note || '' });
    }).catch((e) => setErr(e.message));
  }, [token]);

  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 4000); return () => clearTimeout(t); }, []);

  if (err) return <div className="wrap">{err}</div>;
  if (!d) return <div className="wrap"><p>Loading your invitation…</p>{slow && <p className="muted">The server is waking up. This can take up to a minute, please wait.</p>}</div>;
  const { event: e, guest: g } = d;
  const replied = done || g.status !== 'pending';
  const submit = async () => { await api(`/api/invite/${token}/rsvp`, { method: 'POST', body: f }); setDone(true); };

  return (
    <div className={`page theme-${e.theme || 'classic'}`}>
      <div className="wrap">
        <div className="card invite">
          <p>Dear {g.name},</p>
          <p>You are invited to</p>
          <h1>{e.title}</h1>
          {e.host_names && <p>Hosted by {e.host_names}</p>}
          {e.event_date && <p><b>{new Date(e.event_date).toLocaleString()}</b></p>}
          {e.venue && <p>{e.venue}</p>}
          {e.map_url && <p><a href={e.map_url} target="_blank" rel="noreferrer">View map</a></p>}
          {e.dress_code && <p>Dress code: {e.dress_code}</p>}
          {e.message && <p><i>{e.message}</i></p>}
        </div>

        {e.schedule?.length > 0 && (
          <div className="card sched"><h3>Programme</h3>
            {e.schedule.map((s, i) => <div key={i}><b>{s.time}</b><span>{s.title}</span></div>)}
          </div>
        )}

        <div className="card">
          {replied && <p className="ok">{done ? 'Thank you! Your reply is saved.' : `You replied: ${g.status}.`} You can update it below.</p>}
          <select value={f.status} onChange={(x) => setF({ ...f, status: x.target.value })}>
            <option value="yes">Yes, I'll be there</option><option value="maybe">Maybe</option><option value="no">Sorry, can't make it</option>
          </select>
          {f.status !== 'no' && <>
            <input type="number" min="1" value={f.party_size} onChange={(x) => setF({ ...f, party_size: x.target.value })} placeholder="Number of guests" />
            <input value={f.meal} onChange={(x) => setF({ ...f, meal: x.target.value })} placeholder="Meal preference" />
          </>}
          <textarea value={f.note} onChange={(x) => setF({ ...f, note: x.target.value })} placeholder="Note to the hosts" />
          <button onClick={submit}>Send RSVP</button>
        </div>

        {replied && f.status === 'yes' && (
          <div className="card invite"><h3>Your entry pass</h3>
            <p>Show this QR code at the entrance.</p>
            <div style={{ background: '#fff', display: 'inline-block', padding: 10 }}><QRCodeSVG value={`${location.origin}/i/${token}`} size={170} /></div>
          </div>
        )}

        {e.photos?.length > 0 && (
          <div className="card"><h3>Gallery</h3>
            <div className="gallery">{e.photos.map((u) => <img key={u} src={u} alt="" loading="lazy" />)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
