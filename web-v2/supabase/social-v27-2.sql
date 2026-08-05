-- ArcadiaCorps Social v27.2 - compatibilidad con tablas antiguas

-- La tabla antigua apuntaba a una tabla de usuarios distinta.
alter table public.social_posts
  drop constraint if exists social_posts_user_id_fkey;

alter table public.social_posts
  add constraint social_posts_user_id_fkey
  foreign key (user_id)
  references auth.users(id)
  on delete cascade
  not valid;

-- Columnas necesarias para compatibilidad y nombres visibles.
alter table public.social_posts
  add column if not exists body text,
  add column if not exists image_path text,
  add column if not exists is_featured boolean not null default false;

update public.social_posts
set body = coalesce(body, content, '')
where body is null;

update public.social_posts
set content = coalesce(content, body, '')
where content is null;

update public.social_posts
set username = 'Usuario'
where username is null or btrim(username) = '';

alter table public.social_posts
  alter column body set default '',
  alter column content set default '',
  alter column username set default 'Usuario';

-- Historias agrupadas por usuario. Cada fila es una foto/pantalla del mismo círculo.
alter table public.social_stories
  add column if not exists username text not null default 'Usuario';

update public.social_stories s
set username = coalesce(nullif(p.username, ''), nullif(p.full_name, ''), s.username, 'Usuario')
from public.profiles p
where p.id = s.user_id
  and (s.username is null or s.username = '' or s.username = 'Usuario');

alter table public.social_stories
  drop constraint if exists social_stories_user_id_fkey;

alter table public.social_stories
  add constraint social_stories_user_id_fkey
  foreign key (user_id)
  references auth.users(id)
  on delete cascade
  not valid;

alter table public.social_stories enable row level security;

drop policy if exists "social_stories_delete" on public.social_stories;
create policy "social_stories_delete"
on public.social_stories
for delete
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('owner', 'staff')
  )
);

notify pgrst, 'reload schema';
