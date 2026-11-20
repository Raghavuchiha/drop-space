-- DropSpace schema and private storage policies.
-- Run this ONCE in Supabase Dashboard > SQL Editor, preferably in a new project.
-- Uses Auth, Postgres/RLS, and Storage. No public file access.

create table if not exists public.drop_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('file', 'note', 'link')),
  title text not null check (char_length(trim(title)) between 1 and 500),
  body text,
  url text,
  storage_path text,
  mime_type text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  starred boolean not null default false,
  created_at timestamptz not null default now(),
  constraint drop_items_payload_check check (
    (kind = 'file' and storage_path is not null)
    or (kind = 'note' and body is not null)
    or (kind = 'link' and url is not null)
  )
);

create index if not exists drop_items_user_created_idx on public.drop_items(user_id, created_at desc);
alter table public.drop_items enable row level security;

grant select, insert, update, delete on public.drop_items to authenticated;

drop policy if exists "dropspace items select own" on public.drop_items;
create policy "dropspace items select own"
on public.drop_items for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "dropspace items insert own" on public.drop_items;
create policy "dropspace items insert own"
on public.drop_items for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "dropspace items update own" on public.drop_items;
create policy "dropspace items update own"
on public.drop_items for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "dropspace items delete own" on public.drop_items;
create policy "dropspace items delete own"
on public.drop_items for delete to authenticated
using ((select auth.uid()) = user_id);

-- 50 MB per file; make sure the project's global Storage limit allows this.
insert into storage.buckets (id, name, public, file_size_limit)
values ('drop-space', 'drop-space', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- Object names are stored as:
-- <auth user UUID>/<random UUID>/<sanitized file name>
drop policy if exists "dropspace storage upload own" on storage.objects;
create policy "dropspace storage upload own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'drop-space'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "dropspace storage read own" on storage.objects;
create policy "dropspace storage read own"
on storage.objects for select to authenticated
using (
  bucket_id = 'drop-space'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "dropspace storage delete own" on storage.objects;
create policy "dropspace storage delete own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'drop-space'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
