begin;

-- PRESENCIA Y PRIVACIDAD
alter table public.profiles
  add column if not exists presence_visible boolean not null default true,
  add column if not exists last_seen timestamptz not null default now();

create index if not exists profiles_last_seen_idx on public.profiles(last_seen desc);

create or replace function public.arc_touch_presence()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  touched_at timestamptz := now();
begin
  update public.profiles
  set last_seen = touched_at,
      updated_at = touched_at
  where id = auth.uid();

  return touched_at;
end;
$$;

create or replace function public.arc_set_presence_visibility(new_value boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set presence_visible = coalesce(new_value,true),
      last_seen = now(),
      updated_at = now()
  where id = auth.uid();

  return coalesce(new_value,true);
end;
$$;

create or replace function public.arc_presence_snapshot(target_ids uuid[])
returns table(
  id uuid,
  presence_visible boolean,
  last_seen timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,p.presence_visible,p.last_seen
  from public.profiles p
  where p.id = any(coalesce(target_ids,array[]::uuid[]))
    and (
      p.presence_visible = true
      or p.id = auth.uid()
      or public.current_user_role() in ('owner','staff')
    );
$$;

revoke all on function public.arc_touch_presence() from public;
revoke all on function public.arc_set_presence_visibility(boolean) from public;
revoke all on function public.arc_presence_snapshot(uuid[]) from public;
grant execute on function public.arc_touch_presence() to authenticated;
grant execute on function public.arc_set_presence_visibility(boolean) to authenticated;
grant execute on function public.arc_presence_snapshot(uuid[]) to authenticated;

-- MODERACIÓN COMPLETA DE RESEÑAS
alter table public.arc_reviews
  add column if not exists moderated_by uuid references public.profiles(id) on delete set null,
  add column if not exists moderated_at timestamptz;

drop policy if exists reviews_moderator_read on public.arc_reviews;
create policy reviews_moderator_read
on public.arc_reviews
for select
to authenticated
using (public.current_user_role() in ('owner','staff'));

drop policy if exists reviews_moderator_update on public.arc_reviews;
create policy reviews_moderator_update
on public.arc_reviews
for update
to authenticated
using (public.current_user_role() in ('owner','staff'))
with check (
  public.current_user_role() in ('owner','staff')
  and status in ('pending','approved','rejected')
);

drop policy if exists reviews_moderator_delete on public.arc_reviews;
create policy reviews_moderator_delete
on public.arc_reviews
for delete
to authenticated
using (public.current_user_role() in ('owner','staff'));

grant select,update,delete on public.arc_reviews to authenticated;

-- NOTIFICACIONES
create table if not exists public.arc_notifications(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'general',
  title text not null,
  body text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists arc_notifications_user_created_idx
  on public.arc_notifications(user_id,created_at desc);

alter table public.arc_notifications enable row level security;

drop policy if exists notifications_select_own on public.arc_notifications;
create policy notifications_select_own
on public.arc_notifications
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.arc_notifications;
create policy notifications_update_own
on public.arc_notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

grant select on public.arc_notifications to authenticated;
grant update(read_at) on public.arc_notifications to authenticated;

create or replace function public.arc_notify_review_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'pending'
     and new.status in ('approved','rejected')
     and new.status is distinct from old.status then

    insert into public.arc_notifications(user_id,type,title,body,link)
    values(
      new.owner_id,
      'review_status',
      case when new.status='approved'
        then 'Tu reseña fue aprobada'
        else 'Tu reseña fue rechazada'
      end,
      case when new.status='approved'
        then 'Tu opinión ya aparece en las reseñas de ArcadiaCorps.'
        else 'Tu reseña no fue publicada. Puedes enviar una nueva respetando las normas.'
      end,
      '/web-v2/dashboard.html?v=36#reviews'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists arc_reviews_status_notification on public.arc_reviews;
create trigger arc_reviews_status_notification
after update of status on public.arc_reviews
for each row
execute function public.arc_notify_review_status();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='arc_notifications'
  ) then
    alter publication supabase_realtime add table public.arc_notifications;
  end if;
end $$;

notify pgrst,'reload schema';
commit;
