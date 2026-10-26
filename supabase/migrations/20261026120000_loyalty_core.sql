-- FAB Intel loyalty core.
-- Read before writing: new Supabase project, no existing tables.
-- Tables: app_admins, bars, bar_members, patrons, visits, rewards,
-- decision_log, pin_attempts. RLS on every table.
-- Writes go through Netlify functions with the service role.
-- Authenticated users read only the bars they belong to.
-- Nothing is granted to anon.

create extension if not exists pgcrypto;

create table public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.bars (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,48}$'),
  name text not null check (length(name) between 2 and 120),
  reward_goal integer not null default 10 check (reward_goal between 2 and 50),
  reward_label text not null default 'Free drink',
  staff_pin_hash text not null,
  avg_ticket numeric(10, 2),
  active boolean not null default true,
  predictive_validated_at timestamptz,
  agent_limit_signed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.bar_members (
  bar_id uuid not null references public.bars (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'manager')),
  created_at timestamptz not null default now(),
  primary key (bar_id, user_id)
);

create table public.patrons (
  id uuid primary key default gen_random_uuid(),
  bar_id uuid not null references public.bars (id) on delete cascade,
  display_name text not null check (length(display_name) between 1 and 80),
  email text,
  phone text,
  card_code text not null unique,
  consent_at timestamptz not null,
  consent_text text not null,
  created_at timestamptz not null default now(),
  check (email is not null or phone is not null)
);
create unique index patrons_bar_email_uq on public.patrons (bar_id, email) where email is not null;
create unique index patrons_bar_phone_uq on public.patrons (bar_id, phone) where phone is not null;

create table public.visits (
  id bigint generated always as identity primary key,
  bar_id uuid not null references public.bars (id) on delete cascade,
  patron_id uuid not null references public.patrons (id) on delete cascade,
  confirmed_at timestamptz not null default now(),
  voided_at timestamptz
);
create index visits_bar_idx on public.visits (bar_id, confirmed_at);
create index visits_patron_idx on public.visits (patron_id, confirmed_at);

create table public.rewards (
  id bigint generated always as identity primary key,
  bar_id uuid not null references public.bars (id) on delete cascade,
  patron_id uuid not null references public.patrons (id) on delete cascade,
  earned_at timestamptz not null default now(),
  redeemed_at timestamptz
);
create index rewards_patron_idx on public.rewards (patron_id, earned_at);

-- Insert only. Every recorded decision feeds the AI Transformation Roadmap.
create table public.decision_log (
  id bigint generated always as identity primary key,
  bar_id uuid references public.bars (id) on delete cascade,
  actor uuid,
  kind text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index decision_log_bar_idx on public.decision_log (bar_id, created_at);

create table public.pin_attempts (
  id bigint generated always as identity primary key,
  bar_id uuid not null references public.bars (id) on delete cascade,
  client_key text not null,
  success boolean not null,
  attempted_at timestamptz not null default now()
);
create index pin_attempts_idx on public.pin_attempts (bar_id, client_key, attempted_at);

-- Helpers. security definer so policies can read membership without recursion.
create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (select 1 from public.app_admins a where a.user_id = auth.uid());
$fn$;

create or replace function public.is_bar_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select public.is_app_admin()
    or exists (
      select 1 from public.bar_members m
      where m.bar_id = target and m.user_id = auth.uid()
    );
$fn$;

revoke all on function public.is_app_admin() from public, anon;
revoke all on function public.is_bar_member(uuid) from public, anon;
grant execute on function public.is_app_admin() to authenticated;
grant execute on function public.is_bar_member(uuid) to authenticated;

-- Grants. Authenticated read only. Service role does all writes.
-- Supabase grants anon and authenticated full table rights by default. Remove them first.
revoke all on public.app_admins, public.bars, public.bar_members, public.patrons,
  public.visits, public.rewards, public.decision_log, public.pin_attempts from anon, authenticated;
grant select on public.app_admins, public.bar_members, public.patrons,
  public.visits, public.rewards, public.decision_log to authenticated;
-- bars: every column except staff_pin_hash. Client code never selects *.
grant select (id, slug, name, reward_goal, reward_label, avg_ticket, active,
  predictive_validated_at, agent_limit_signed_at, created_at)
  on public.bars to authenticated;
grant all on public.app_admins, public.bars, public.bar_members, public.patrons,
  public.visits, public.rewards, public.decision_log, public.pin_attempts to service_role;

alter table public.app_admins enable row level security;
alter table public.bars enable row level security;
alter table public.bar_members enable row level security;
alter table public.patrons enable row level security;
alter table public.visits enable row level security;
alter table public.rewards enable row level security;
alter table public.decision_log enable row level security;
alter table public.pin_attempts enable row level security;

create policy app_admins_self_read on public.app_admins
  for select to authenticated using (user_id = auth.uid());

create policy bars_member_read on public.bars
  for select to authenticated using (public.is_bar_member(id));

create policy bar_members_read on public.bar_members
  for select to authenticated using (user_id = auth.uid() or public.is_app_admin());

create policy patrons_member_read on public.patrons
  for select to authenticated using (public.is_bar_member(bar_id));

create policy visits_member_read on public.visits
  for select to authenticated using (public.is_bar_member(bar_id));

create policy rewards_member_read on public.rewards
  for select to authenticated using (public.is_bar_member(bar_id));

create policy decision_log_member_read on public.decision_log
  for select to authenticated using (bar_id is not null and public.is_bar_member(bar_id));

-- pin_attempts has RLS on and no policies: service role only.
