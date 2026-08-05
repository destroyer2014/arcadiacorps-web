-- ArcadiaCorps Chat v29: grupos, solicitudes, respuestas y administración
create extension if not exists pgcrypto;

alter table public.arc_chat_conversations add column if not exists type text not null default 'direct';
alter table public.arc_chat_conversations add column if not exists name text;
alter table public.arc_chat_conversations add column if not exists description text;
alter table public.arc_chat_conversations add column if not exists avatar_path text;
alter table public.arc_chat_conversations add column if not exists owner_id uuid references auth.users(id) on delete set null;
alter table public.arc_chat_conversations add column if not exists invite_code text unique default encode(gen_random_bytes(6),'hex');
alter table public.arc_chat_participants add column if not exists member_role text not null default 'member';
alter table public.arc_chat_participants add column if not exists status text not null default 'active';
alter table public.arc_chat_messages add column if not exists reply_to uuid references public.arc_chat_messages(id) on delete set null;

create table if not exists public.arc_chat_group_requests(
 id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.arc_chat_conversations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, status text not null default 'pending', created_at timestamptz not null default now(), resolved_at timestamptz,
 unique(conversation_id,user_id)
);
alter table public.arc_chat_group_requests enable row level security;

create or replace function public.arc_group_can_manage(cid uuid, uid uuid default auth.uid()) returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.arc_chat_participants where conversation_id=cid and user_id=uid and status='active' and member_role in('owner','admin'))
$$;

create or replace function public.arc_create_group(group_name text, group_description text default '', initial_members uuid[] default '{}') returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid; m uuid;
begin
 if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
 insert into public.arc_chat_conversations(type,name,description,owner_id) values('group',group_name,group_description,auth.uid()) returning id into cid;
 insert into public.arc_chat_participants(conversation_id,user_id,member_role,status) values(cid,auth.uid(),'owner','active');
 foreach m in array initial_members loop if m<>auth.uid() then insert into public.arc_chat_participants(conversation_id,user_id,member_role,status) values(cid,m,'member','active') on conflict do nothing; end if; end loop;
 return cid;
end $$;

create or replace function public.arc_request_group_join(invite text) returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid; rid uuid;
begin
 select id into cid from public.arc_chat_conversations where type='group' and invite_code=invite;
 if cid is null then raise exception 'Invitación no válida'; end if;
 if exists(select 1 from public.arc_chat_participants where conversation_id=cid and user_id=auth.uid() and status='active') then raise exception 'Ya perteneces al grupo'; end if;
 insert into public.arc_chat_group_requests(conversation_id,user_id,status) values(cid,auth.uid(),'pending') on conflict(conversation_id,user_id) do update set status='pending',created_at=now(),resolved_at=null returning id into rid;
 return rid;
end $$;

create or replace function public.arc_resolve_group_request(request_id uuid, approve boolean) returns void language plpgsql security definer set search_path=public as $$
declare r public.arc_chat_group_requests;
begin
 select * into r from public.arc_chat_group_requests where id=request_id; if r.id is null then raise exception 'Solicitud no encontrada'; end if;
 if not public.arc_group_can_manage(r.conversation_id) then raise exception 'Sin permisos'; end if;
 update public.arc_chat_group_requests set status=case when approve then 'accepted' else 'rejected' end,resolved_at=now() where id=request_id;
 if approve then insert into public.arc_chat_participants(conversation_id,user_id,member_role,status) values(r.conversation_id,r.user_id,'member','active') on conflict(conversation_id,user_id) do update set status='active'; end if;
end $$;

create or replace function public.arc_set_group_admin(cid uuid,target_user uuid,make_admin boolean) returns void language plpgsql security definer set search_path=public as $$
begin if not exists(select 1 from public.arc_chat_participants where conversation_id=cid and user_id=auth.uid() and member_role='owner') then raise exception 'Solo el propietario'; end if; update public.arc_chat_participants set member_role=case when make_admin then 'admin' else 'member' end where conversation_id=cid and user_id=target_user and member_role<>'owner'; end $$;
create or replace function public.arc_remove_group_member(cid uuid,target_user uuid) returns void language plpgsql security definer set search_path=public as $$ begin if not public.arc_group_can_manage(cid) then raise exception 'Sin permisos'; end if; delete from public.arc_chat_participants where conversation_id=cid and user_id=target_user and member_role<>'owner'; end $$;
create or replace function public.arc_leave_group(cid uuid) returns void language plpgsql security definer set search_path=public as $$ begin if exists(select 1 from public.arc_chat_participants where conversation_id=cid and user_id=auth.uid() and member_role='owner') then raise exception 'El propietario debe transferir o eliminar el grupo'; end if; delete from public.arc_chat_participants where conversation_id=cid and user_id=auth.uid(); end $$;
create or replace function public.arc_delete_group(cid uuid) returns void language plpgsql security definer set search_path=public as $$ begin if not exists(select 1 from public.arc_chat_participants where conversation_id=cid and user_id=auth.uid() and member_role='owner') then raise exception 'Solo el propietario'; end if; delete from public.arc_chat_conversations where id=cid; end $$;
create or replace function public.arc_regenerate_invite(cid uuid) returns text language plpgsql security definer set search_path=public as $$ declare code text; begin if not public.arc_group_can_manage(cid) then raise exception 'Sin permisos'; end if; code:=encode(gen_random_bytes(6),'hex'); update public.arc_chat_conversations set invite_code=code where id=cid; return code; end $$;

grant execute on function public.arc_create_group(text,text,uuid[]) to authenticated;
grant execute on function public.arc_request_group_join(text) to authenticated;
grant execute on function public.arc_resolve_group_request(uuid,boolean) to authenticated;
grant execute on function public.arc_set_group_admin(uuid,uuid,boolean) to authenticated;
grant execute on function public.arc_remove_group_member(uuid,uuid) to authenticated;
grant execute on function public.arc_leave_group(uuid) to authenticated;
grant execute on function public.arc_delete_group(uuid) to authenticated;
grant execute on function public.arc_regenerate_invite(uuid) to authenticated;

drop policy if exists arc_group_requests_select on public.arc_chat_group_requests;
drop policy if exists arc_group_requests_insert on public.arc_chat_group_requests;
create policy arc_group_requests_select on public.arc_chat_group_requests for select to authenticated using(user_id=auth.uid() or public.arc_group_can_manage(conversation_id));
create policy arc_group_requests_insert on public.arc_chat_group_requests for insert to authenticated with check(user_id=auth.uid());

-- limitar lectura de participantes a miembros activos
alter table public.arc_chat_participants enable row level security;
-- El sistema existente conserva sus políticas; las funciones security definer manejan altas y administración.

do $$ begin alter publication supabase_realtime add table public.arc_chat_group_requests; exception when duplicate_object then null; end $$;
notify pgrst,'reload schema';
