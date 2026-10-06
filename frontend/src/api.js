import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const envOk = Boolean(url && key);
// placeholders stop the app crashing when .env is missing; the admin shows a setup message instead
export const supabase = createClient(url || 'http://localhost', key || 'missing');

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const CC = import.meta.env.VITE_DEFAULT_COUNTRY_CODE || '255';

// 0712345678 -> 255712345678 (WhatsApp links need the country code)
export function waNumber(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = CC + d.slice(1);
  else if (d.length <= 9 && !d.startsWith(CC)) d = CC + d; // Excel dropped the leading 0
  return d;
}

export async function api(path, { method = 'GET', body, authed = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authed) {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error('Please sign in again.');
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  let res;
  try {
    res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error(`Cannot reach the server at ${API || '(VITE_API_URL is empty)'}. Is the backend running?`);
  }
  let json = {};
  try { json = await res.json(); } catch { /* non-JSON response */ }
  if (res.status === 401 && authed) await supabase.auth.signOut();
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}
