-- ArcadiaCorps Web 2.0 — tickets, imágenes e historial de compras
create extension if not exists pgcrypto;

do $$ begin
  create type public.ticket_status as enum ('open','in_progress','waiting_user','closed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.ticket_priority as enum ('low','normal','high','urgent');
exception when duplicate_object then null; end $$;

create sequence if not exists public.ticket_number_seq start 1001;
create table if not exists public.tickets(
 id uuid primary key default gen_random_uuid(),
 ticket_number text unique not null default ('AC-'||to_char(now(),'YYMM')||'-'||lpad(nextval('public.ticket_number_seq')::text,5,'0')),
 user_id uuid not null references auth.users(id) on delete cascade,
 subject text not null check(char_length(subject) between 3 and 140),
 category text not null default 'Otro',
 priority public.ticket_priority not null default 'normal',
 status public.ticket_status not null default 'open',
 assigned_to uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), closed_at timestamptz
);
create table if not exists public.ticket_messages(
 id uuid primary key default gen_random_uuid(), ticket_id uuid not null references public.tickets(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade, body text not null check(char_length(body) between 1 and 5000),
 attachments text[] not null default '{}', created_at timestamptz not null default now()
);
create table if not exists public.purchases(
 id uuid primary key default gen_random_uuid(), order_number text unique not null default ('ORD-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
 user_id uuid not null references auth.users(id) on delete cascade, product_name text not null, product_type text,
 amount numeric(12,2) not null check(amount>=0), currency text not null default 'PEN', status text not null default 'completada',
 metadata jsonb not null default '{}', purchased_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create index if not exists tickets_user_idx on public.tickets(user_id,updated_at desc);
create index if not exists ticket_messages_ticket_idx on public.ticket_messages(ticket_id,created_at);
create index if not exists purchases_user_idx on public.purchases(user_id,purchased_at desc);

create or replace function public.is_support_member() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text in ('owner','staff'));
$$;

alter table public.tickets enable row level security; alter table public.ticket_messages enable row level security; alter table public.purchases enable row level security;
drop policy if exists tickets_select on public.tickets; create policy tickets_select on public.tickets for select to authenticated using(user_id=auth.uid() or public.is_support_member());
drop policy if exists tickets_insert on public.tickets; create policy tickets_insert on public.tickets for insert to authenticated with check(user_id=auth.uid());
drop policy if exists tickets_update on public.tickets; create policy tickets_update on public.tickets for update to authenticated using(public.is_support_member()) with check(public.is_support_member());
drop policy if exists messages_select on public.ticket_messages; create policy messages_select on public.ticket_messages for select to authenticated using(exists(select 1 from public.tickets t where t.id=ticket_id and (t.user_id=auth.uid() or public.is_support_member())));
drop policy if exists messages_insert on public.ticket_messages; create policy messages_insert on public.ticket_messages for insert to authenticated with check(author_id=auth.uid() and exists(select 1 from public.tickets t where t.id=ticket_id and (t.user_id=auth.uid() or public.is_support_member())));
drop policy if exists purchases_select on public.purchases; create policy purchases_select on public.purchases for select to authenticated using(user_id=auth.uid() or public.is_support_member());
drop policy if exists purchases_support_write on public.purchases; create policy purchases_support_write on public.purchases for all to authenticated using(public.is_support_member()) with check(public.is_support_member());
grant select,insert on public.tickets to authenticated; grant update on public.tickets to authenticated; grant select,insert on public.ticket_messages to authenticated; grant select,insert,update,delete on public.purchases to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('ticket-images','ticket-images',false,5242880,array['image/jpeg','image/png','image/webp','image/gif']) on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists ticket_images_insert on storage.objects; create policy ticket_images_insert on storage.objects for insert to authenticated with check(bucket_id='ticket-images' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists ticket_images_select on storage.objects; create policy ticket_images_select on storage.objects for select to authenticated using(bucket_id='ticket-images' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_support_member()));
drop policy if exists ticket_images_delete on storage.objects; create policy ticket_images_delete on storage.objects for delete to authenticated using(bucket_id='ticket-images' and ((storage.foldername(name))[1]=auth.uid()::text or public.is_support_member()));
notify pgrst,'reload schema';
