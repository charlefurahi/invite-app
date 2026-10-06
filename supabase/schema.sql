create table events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  host_names text,
  event_date timestamptz,
  venue text,
  map_url text,
  dress_code text,
  message text,
  created_at timestamptz default now()
);
create table guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  token text not null unique,
  status text not null default 'pending' check (status in ('pending','yes','no','maybe')),
  party_size int default 1,
  meal text,
  note text,
  opened_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz default now()
);
create index on guests(event_id);
-- Backend uses the service key; lock tables from direct public access:
alter table events enable row level security;
alter table guests enable row level security;
