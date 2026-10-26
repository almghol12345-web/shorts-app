-- ============================================================
-- Fajr Survivors · Supabase database setup
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to run again: it only creates what is missing and replaces functions.
-- ============================================================

-- ---------- admins ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

drop policy if exists "admins read self" on public.admins;
create policy "admins read self" on public.admins for select using (user_id = auth.uid());

-- ---------- players ----------
create table if not exists public.players (
  id uuid primary key references auth.users(id) on delete cascade,
  short_id bigint generated always as identity (start with 100001) unique,
  name text not null default 'Commander',
  power bigint not null default 0,
  level int not null default 1,
  stage int not null default 1,
  hq int not null default 1,
  gems bigint not null default 0,
  vip int not null default 0,
  spent numeric(12,2) not null default 0,
  lang text,
  app_version text,
  save jsonb,
  banned boolean not null default false,
  ban_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists players_power_idx on public.players (power desc);
create index if not exists players_updated_idx on public.players (updated_at desc);
alter table public.players enable row level security;

drop policy if exists "players read own" on public.players;
create policy "players read own" on public.players for select using (id = auth.uid() or public.is_admin());
drop policy if exists "players insert own" on public.players;
create policy "players insert own" on public.players for insert with check (id = auth.uid());
drop policy if exists "players update own" on public.players;
create policy "players update own" on public.players for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- Players can never change their own ban status or spending; only admins can.
-- Runs as the caller: API requests run as anon/authenticated, while the Supabase dashboard and the
-- purchase-log trigger run as the owner and are trusted.
create or replace function public.players_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.banned := false; new.ban_reason := null; new.spent := 0;
    else
      new.banned := old.banned; new.ban_reason := old.ban_reason; new.spent := old.spent; new.created_at := old.created_at;
    end if;
  end if;
  new.name := left(coalesce(nullif(btrim(new.name), ''), 'Commander'), 20);
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists players_guard on public.players;
create trigger players_guard before insert or update on public.players for each row execute function public.players_guard();

-- ---------- gifts from the admin ----------
create table if not exists public.grants (
  id bigint generated always as identity primary key,
  player_id uuid references public.players(id) on delete cascade,  -- null = every player
  rewards jsonb not null,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  claimed_at timestamptz
);
create index if not exists grants_player_idx on public.grants (player_id) where claimed_at is null;
create table if not exists public.grant_claims (
  grant_id bigint not null references public.grants(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  primary key (grant_id, player_id)
);
alter table public.grants enable row level security;
alter table public.grant_claims enable row level security;
drop policy if exists "grants admin all" on public.grants;
create policy "grants admin all" on public.grants for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "grants read own" on public.grants;
create policy "grants read own" on public.grants for select using (player_id = auth.uid());
drop policy if exists "claims admin read" on public.grant_claims;
create policy "claims admin read" on public.grant_claims for select using (public.is_admin());

-- Called by the game: returns unclaimed gifts for this player and marks them claimed.
create or replace function public.claim_grants()
returns table (gid bigint, rewards jsonb, note text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare me uuid := auth.uid();
begin
  if me is null then return; end if;
  if not exists (select 1 from public.players p where p.id = me and not p.banned) then return; end if;
  return query
  with personal as (
    update public.grants g set claimed_at = now()
    where g.player_id = me and g.claimed_at is null and (g.expires_at is null or g.expires_at > now())
    returning g.id, g.rewards, g.note
  ), global_new as (
    insert into public.grant_claims (grant_id, player_id)
    select g.id, me from public.grants g
    where g.player_id is null and (g.expires_at is null or g.expires_at > now())
    on conflict do nothing
    returning grant_id
  )
  select personal.id, personal.rewards, personal.note from personal
  union all
  select g.id, g.rewards, g.note from public.grants g join global_new on global_new.grant_id = g.id;
end $$;

-- ---------- events ----------
create table if not exists public.events (
  id bigint generated always as identity primary key,
  type text not null check (type in ('double','production','discount','gift','kills')),
  title jsonb not null default '{}'::jsonb,
  body jsonb not null default '{}'::jsonb,
  params jsonb not null default '{}'::jsonb,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.events enable row level security;
drop policy if exists "events read" on public.events;
create policy "events read" on public.events for select using (active or public.is_admin());
drop policy if exists "events admin write" on public.events;
create policy "events admin write" on public.events for all using (public.is_admin()) with check (public.is_admin());

-- ---------- news ----------
create table if not exists public.news (
  id bigint generated always as identity primary key,
  title jsonb not null default '{}'::jsonb,
  body jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.news enable row level security;
drop policy if exists "news read" on public.news;
create policy "news read" on public.news for select using (true);
drop policy if exists "news admin write" on public.news;
create policy "news admin write" on public.news for all using (public.is_admin()) with check (public.is_admin());

-- ---------- remote config ----------
create table if not exists public.config (
  key text primary key,
  value jsonb,
  updated_at timestamptz not null default now()
);
alter table public.config enable row level security;
drop policy if exists "config read" on public.config;
create policy "config read" on public.config for select using (true);
drop policy if exists "config admin write" on public.config;
create policy "config admin write" on public.config for all using (public.is_admin()) with check (public.is_admin());

-- ---------- purchases log ----------
create table if not exists public.purchases (
  id bigint generated always as identity primary key,
  player_id uuid not null default auth.uid() references public.players(id) on delete cascade,
  product_id text not null,
  transaction_id text not null unique,
  price numeric(12,2),
  currency text,
  gems int,
  receipt text,
  created_at timestamptz not null default now()
);
create index if not exists purchases_created_idx on public.purchases (created_at desc);
alter table public.purchases enable row level security;
drop policy if exists "purchases insert own" on public.purchases;
create policy "purchases insert own" on public.purchases for insert with check (player_id = auth.uid());
drop policy if exists "purchases read" on public.purchases;
create policy "purchases read" on public.purchases for select using (player_id = auth.uid() or public.is_admin());

create or replace function public.purchases_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.players set spent = spent + coalesce(new.price, 0) where id = new.player_id;
  return new;
end $$;
drop trigger if exists purchases_after on public.purchases;
create trigger purchases_after after insert on public.purchases for each row execute function public.purchases_after();

-- ---------- leaderboard (public names and power only) ----------
create or replace function public.leaderboard()
returns table (short_id bigint, name text, power bigint, level int, vip int)
language sql stable security definer set search_path = public as $$
  select p.short_id, p.name, p.power, p.level, p.vip from public.players p
  where not p.banned order by p.power desc limit 100;
$$;

-- ---------- admin dashboard numbers ----------
create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not admin'; end if;
  return jsonb_build_object(
    'players', (select count(*) from public.players),
    'active_24h', (select count(*) from public.players where updated_at > now() - interval '24 hours'),
    'new_today', (select count(*) from public.players where created_at > date_trunc('day', now())),
    'banned', (select count(*) from public.players where banned),
    'purchases', (select count(*) from public.purchases),
    'purchases_today', (select count(*) from public.purchases where created_at > date_trunc('day', now())),
    'revenue', (select coalesce(sum(price), 0) from public.purchases),
    'revenue_today', (select coalesce(sum(price), 0) from public.purchases where created_at > date_trunc('day', now()))
  );
end $$;

-- ---------- account deletion (required by the App Store) ----------
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then return; end if;
  delete from auth.users where id = auth.uid();  -- cascades to players, gifts, purchases
end $$;

-- ---------- permissions for the API roles ----------
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.players to authenticated;
grant select, insert, update, delete on public.grants, public.events, public.news, public.config to authenticated;
grant select on public.grant_claims, public.admins to authenticated;
grant select, insert on public.purchases to authenticated;
grant select on public.events, public.news, public.config to anon;
grant execute on function public.is_admin(), public.claim_grants(), public.leaderboard(), public.admin_stats(), public.delete_my_account() to authenticated;
grant execute on function public.leaderboard() to anon;

-- ============================================================
-- LAST STEP: make yourself the admin.
-- 1) Supabase > Authentication > Users > Add user > Create new user (your email + a strong password, tick "Auto Confirm").
-- 2) Put that email below and run just this line:
--    insert into public.admins (user_id) select id from auth.users where email = 'YOUR_EMAIL_HERE' on conflict do nothing;
-- ============================================================
