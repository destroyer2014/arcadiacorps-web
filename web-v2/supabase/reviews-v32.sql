begin;
create extension if not exists pgcrypto;
create table if not exists public.arc_reviews(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 user_name text not null,
 avatar_url text,
 rating smallint not null check(rating between 1 and 5),
 comment text not null check(char_length(comment) between 3 and 500),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.arc_reviews enable row level security;
drop policy if exists reviews_public_read on public.arc_reviews;
create policy reviews_public_read on public.arc_reviews for select to authenticated using(status='approved' or owner_id=auth.uid());
drop policy if exists reviews_insert_own on public.arc_reviews;
create policy reviews_insert_own on public.arc_reviews for insert to authenticated with check(owner_id=auth.uid());
drop policy if exists reviews_update_own_pending on public.arc_reviews;
create policy reviews_update_own_pending on public.arc_reviews for update to authenticated using(owner_id=auth.uid() and status='pending') with check(owner_id=auth.uid() and status='pending');
drop policy if exists reviews_delete_own on public.arc_reviews;
create policy reviews_delete_own on public.arc_reviews for delete to authenticated using(owner_id=auth.uid());
grant select,insert,update,delete on public.arc_reviews to authenticated;
notify pgrst,'reload schema';
commit;
