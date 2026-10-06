-- Run after schema.sql
alter table events add column if not exists theme text default 'classic';
alter table events add column if not exists schedule jsonb default '[]';
alter table events add column if not exists photos text[] default '{}';
alter table guests add column if not exists phone text;
alter table guests add column if not exists email text;
alter table guests add column if not exists checked_in_at timestamptz;
alter table guests add column if not exists checked_in_count int;

insert into storage.buckets (id, name, public) values ('event-photos', 'event-photos', true) on conflict do nothing;
create policy "auth upload photos" on storage.objects for insert to authenticated with check (bucket_id = 'event-photos');
create policy "public read photos" on storage.objects for select using (bucket_id = 'event-photos');
