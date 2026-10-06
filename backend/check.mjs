import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_KEY, FRONTEND_URL } = process.env;
let failed = false;
const ok = (m) => console.log('  OK    ', m);
const bad = (m, hint) => { failed = true; console.log('  FAIL  ', m); if (hint) console.log('        ->', hint); };

console.log('\nChecking backend/.env ...');
if (!SUPABASE_URL || SUPABASE_URL.includes('xxxx')) bad('SUPABASE_URL missing', 'put your real project URL in backend/.env');
else ok('SUPABASE_URL set');
if (!SUPABASE_SERVICE_KEY || SUPABASE_SERVICE_KEY.startsWith('sb_publishable_') || SUPABASE_SERVICE_KEY.includes('your-'))
  bad('SUPABASE_SERVICE_KEY is missing or is the PUBLIC key', 'use the sb_secret_... key (or legacy service_role key)');
else ok('SUPABASE_SERVICE_KEY looks like a secret key');
if (!FRONTEND_URL) bad('FRONTEND_URL missing', 'use http://localhost:5173'); else ok(`FRONTEND_URL = ${FRONTEND_URL}`);
if (failed) process.exit(1);

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
console.log('\nChecking database ...');
const tests = [
  ['events table + new columns', () => sb.from('events').select('id,theme,schedule,photos').limit(1)],
  ['guests table + new columns', () => sb.from('guests').select('id,phone,email,checked_in_at,checked_in_count').limit(1)],
];
for (const [name, run] of tests) {
  const { error } = await run();
  if (error) bad(name, `${error.message} (run supabase/schema.sql then supabase/migration_2.sql in the SQL Editor)`);
  else ok(name);
}
const { data: bucket, error: be } = await sb.storage.getBucket('event-photos');
if (be || !bucket) bad('storage bucket event-photos', 'run supabase/migration_2.sql'); else ok('storage bucket event-photos');

console.log(failed ? '\nSome checks failed. Fix the items above and run again.\n' : '\nAll checks passed. You can start the backend.\n');
process.exit(failed ? 1 : 0);
