-- Career Coach usage events, written by track.js.
-- Browsers may only ADD rows; nobody can read them through the public key.

create table if not exists public.events (
  id                 bigint generated always as identity primary key,
  created_at         timestamptz not null default now(),
  visitor_id         uuid not null,
  user_id            uuid,
  event              text not null check (event ~ '^[a-z_]{2,40}$'),
  page               text check (char_length(page) <= 120),
  source             text check (char_length(source) <= 120),
  utm_source         text check (char_length(utm_source) <= 60),
  utm_medium         text check (char_length(utm_medium) <= 60),
  utm_campaign       text check (char_length(utm_campaign) <= 80),
  first_source       text check (char_length(first_source) <= 120),
  first_utm_source   text check (char_length(first_utm_source) <= 60),
  first_utm_medium   text check (char_length(first_utm_medium) <= 60),
  first_utm_campaign text check (char_length(first_utm_campaign) <= 80),
  device             text check (device in ('phone', 'computer')),
  is_team            boolean not null default false
);

create index if not exists events_created_at_idx on public.events (created_at);
create index if not exists events_event_idx      on public.events (event, created_at);
create index if not exists events_visitor_idx    on public.events (visitor_id);

alter table public.events enable row level security;

revoke all on public.events from anon, authenticated;
grant insert on public.events to anon, authenticated;

drop policy if exists "visitors can add events" on public.events;
create policy "visitors can add events"
  on public.events for insert
  to anon
  with check (user_id is null);

drop policy if exists "signed-in users can add their own events" on public.events;
create policy "signed-in users can add their own events"
  on public.events for insert
  to authenticated
  with check (user_id is null or user_id = auth.uid());
