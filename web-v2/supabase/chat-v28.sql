-- ArcadiaCorps Chat v28
-- Tablas con prefijo arc_ para evitar conflictos con módulos antiguos.
create extension if not exists pgcrypto;

create table if not exists public.arc_chat_conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.arc_chat_participants (
  conversation_id uuid not null references public.arc_chat_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id,user_id)
);

create table if not exists public.arc_chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.arc_chat_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text,
  image_path text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint arc_chat_message_has_content check (body is not null or image_path is not null or deleted_at is not null)
);

create table if not exists public.arc_chat_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(blocker_id,blocked_id),
  constraint arc_chat_no_self_block check (blocker_id <> blocked_id)
);

create index if not exists arc_chat_messages_conversation_created_idx on public.arc_chat_messages(conversation_id,created_at);
create index if not exists arc_chat_participants_user_idx on public.arc_chat_participants(user_id);

create or replace function public.arc_is_chat_participant(cid uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.arc_chat_participants where conversation_id=cid and user_id=uid)
$$;

create or replace function public.arc_get_or_create_chat(other_user uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare found_id uuid; new_id uuid;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  if other_user=auth.uid() then raise exception 'No puedes iniciar un chat contigo mismo'; end if;
  if not exists(select 1 from auth.users where id=other_user) then raise exception 'Usuario no encontrado'; end if;
  select p1.conversation_id into found_id
  from public.arc_chat_participants p1
  join public.arc_chat_participants p2 on p2.conversation_id=p1.conversation_id
  where p1.user_id=auth.uid() and p2.user_id=other_user
    and (select count(*) from public.arc_chat_participants px where px.conversation_id=p1.conversation_id)=2
  limit 1;
  if found_id is not null then return found_id; end if;
  insert into public.arc_chat_conversations default values returning id into new_id;
  insert into public.arc_chat_participants(conversation_id,user_id) values(new_id,auth.uid()),(new_id,other_user);
  return new_id;
end $$;

grant execute on function public.arc_get_or_create_chat(uuid) to authenticated;

alter table public.arc_chat_conversations enable row level security;
alter table public.arc_chat_participants enable row level security;
alter table public.arc_chat_messages enable row level security;
alter table public.arc_chat_blocks enable row level security;

drop policy if exists arc_chat_conversations_select on public.arc_chat_conversations;
drop policy if exists arc_chat_conversations_update on public.arc_chat_conversations;
create policy arc_chat_conversations_select on public.arc_chat_conversations for select to authenticated using(public.arc_is_chat_participant(id));
create policy arc_chat_conversations_update on public.arc_chat_conversations for update to authenticated using(public.arc_is_chat_participant(id)) with check(public.arc_is_chat_participant(id));

drop policy if exists arc_chat_participants_select on public.arc_chat_participants;
drop policy if exists arc_chat_participants_update on public.arc_chat_participants;
create policy arc_chat_participants_select on public.arc_chat_participants for select to authenticated using(public.arc_is_chat_participant(conversation_id));
create policy arc_chat_participants_update on public.arc_chat_participants for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

drop policy if exists arc_chat_messages_select on public.arc_chat_messages;
drop policy if exists arc_chat_messages_insert on public.arc_chat_messages;
drop policy if exists arc_chat_messages_update on public.arc_chat_messages;
create policy arc_chat_messages_select on public.arc_chat_messages for select to authenticated using(public.arc_is_chat_participant(conversation_id));
create policy arc_chat_messages_insert on public.arc_chat_messages for insert to authenticated with check(
  sender_id=auth.uid() and public.arc_is_chat_participant(conversation_id)
  and not exists(
    select 1 from public.arc_chat_participants p
    join public.arc_chat_blocks b on (b.blocker_id=auth.uid() and b.blocked_id=p.user_id) or (b.blocker_id=p.user_id and b.blocked_id=auth.uid())
    where p.conversation_id=arc_chat_messages.conversation_id and p.user_id<>auth.uid()
  )
);
create policy arc_chat_messages_update on public.arc_chat_messages for update to authenticated using(sender_id=auth.uid()) with check(sender_id=auth.uid());

drop policy if exists arc_chat_blocks_select on public.arc_chat_blocks;
drop policy if exists arc_chat_blocks_insert on public.arc_chat_blocks;
drop policy if exists arc_chat_blocks_delete on public.arc_chat_blocks;
create policy arc_chat_blocks_select on public.arc_chat_blocks for select to authenticated using(blocker_id=auth.uid() or blocked_id=auth.uid());
create policy arc_chat_blocks_insert on public.arc_chat_blocks for insert to authenticated with check(blocker_id=auth.uid());
create policy arc_chat_blocks_delete on public.arc_chat_blocks for delete to authenticated using(blocker_id=auth.uid());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('chat-media','chat-media',false,10485760,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists arc_chat_media_read on storage.objects;
drop policy if exists arc_chat_media_insert on storage.objects;
drop policy if exists arc_chat_media_delete on storage.objects;
create policy arc_chat_media_read on storage.objects for select to authenticated using(bucket_id='chat-media');
create policy arc_chat_media_insert on storage.objects for insert to authenticated with check(bucket_id='chat-media' and (storage.foldername(name))[1]=auth.uid()::text);
create policy arc_chat_media_delete on storage.objects for delete to authenticated using(bucket_id='chat-media' and (storage.foldername(name))[1]=auth.uid()::text);

-- Realtime
alter publication supabase_realtime add table public.arc_chat_messages;
notify pgrst,'reload schema';
