-- ArcadiaCorps Web 2.0: roles y permisos reales
-- Conserva los perfiles existentes. No asigna roles automáticamente.

alter table public.profiles
  add column if not exists role text not null default 'user';

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('owner','staff','user'));

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.role from public.profiles p where p.id = auth.uid()), 'user');
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_owner_select_all on public.profiles;

create policy profiles_select_own
on public.profiles for select to authenticated
using (id = auth.uid() or public.current_user_role() = 'owner');

create policy profiles_insert_own
on public.profiles for insert to authenticated
with check (id = auth.uid() and role = 'user');

create policy profiles_update_own
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Los usuarios pueden editar únicamente sus datos personales.
revoke update on public.profiles from authenticated;
grant select, insert on public.profiles to authenticated;
grant update (username, full_name, avatar_url, phone, updated_at) on public.profiles to authenticated;

-- Solo Owner puede cambiar roles mediante esta función auditada.
create or replace function public.admin_set_user_role(target_user_id uuid, new_role text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles;
begin
  if public.current_user_role() <> 'owner' then
    raise exception 'No autorizado';
  end if;
  if new_role not in ('owner','staff','user') then
    raise exception 'Rol no válido';
  end if;
  if target_user_id = auth.uid() and new_role <> 'owner' then
    raise exception 'No puedes retirar tu propio rol Owner desde este panel';
  end if;

  update public.profiles
  set role = new_role, updated_at = now()
  where id = target_user_id
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Perfil no encontrado';
  end if;
  return updated_profile;
end;
$$;

revoke all on function public.admin_set_user_role(uuid,text) from public;
grant execute on function public.admin_set_user_role(uuid,text) to authenticated;
