-- Device pairing records are never exposed to the public Data API.
create table if not exists public.device_pairings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique,
  claim_hash text,
  requester_label text,
  status text not null default 'ready' check (status in ('ready', 'pending', 'approved', 'redeemed', 'denied', 'cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 minutes')
);
create index if not exists device_pairings_owner_idx on public.device_pairings(owner_id, created_at desc);
alter table public.device_pairings enable row level security;
revoke all on public.device_pairings from anon, authenticated, public;

create table if not exists public.device_pair_attempts (
  ip_hash text primary key,
  window_start timestamptz not null default now(),
  attempts integer not null default 0
);
alter table public.device_pair_attempts enable row level security;
revoke all on public.device_pair_attempts from anon, authenticated, public;
-- Edge Function uses its server-only service role. All client access is denied.
