begin;
create extension if not exists pgcrypto;
create table if not exists public.arc_subbots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  bot_id text not null unique,
  phone text not null unique check (phone ~ '^[0-9]{8,15}$'),
  name text not null default 'Nero Subbot' check (char_length(name) between 1 and 40),
  prefix text not null default '.' check (char_length(prefix) between 1 and 4),
  avatar_url text,
  avatar_path text,
  status_text text,
  auto_read boolean not null default false,
  connection_status text not null default 'stopped' check (connection_status in ('stopped','pairing','online','error')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id)
);
create index if not exists arc_subbots_owner_idx on public.arc_subbots(owner_id);
alter table public.arc_subbots enable row level security;
drop policy if exists "subbots_select_own" on public.arc_subbots;
create policy "subbots_select_own" on public.arc_subbots for select to authenticated using (owner_id=auth.uid());
drop policy if exists "subbots_insert_own" on public.arc_subbots;
create policy "subbots_insert_own" on public.arc_subbots for insert to authenticated with check (owner_id=auth.uid() and not exists(select 1 from public.arc_subbots s where s.owner_id=auth.uid()));
drop policy if exists "subbots_update_own" on public.arc_subbots;
create policy "subbots_update_own" on public.arc_subbots for update to authenticated using (owner_id=auth.uid()) with check (owner_id=auth.uid());
drop policy if exists "subbots_delete_own" on public.arc_subbots;
create policy "subbots_delete_own" on public.arc_subbots for delete to authenticated using (owner_id=auth.uid());
create or replace function public.arc_touch_subbot() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
drop trigger if exists arc_subbots_touch on public.arc_subbots;
create trigger arc_subbots_touch before update on public.arc_subbots for each row execute function public.arc_touch_subbot();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('subbot-avatars','subbot-avatars',true,2097152,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=2097152,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "subbot_avatar_insert" on storage.objects;
create policy "subbot_avatar_insert" on storage.objects for insert to authenticated with check(bucket_id='subbot-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "subbot_avatar_update" on storage.objects;
create policy "subbot_avatar_update" on storage.objects for update to authenticated using(bucket_id='subbot-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "subbot_avatar_delete" on storage.objects;
create policy "subbot_avatar_delete" on storage.objects for delete to authenticated using(bucket_id='subbot-avatars' and (storage.foldername(name))[1]=auth.uid()::text);
grant select,insert,update,delete on public.arc_subbots to authenticated;
notify pgrst,'reload schema';
commit;
