-- ArcadiaCorps Social v27.3 - compatibilidad de comentarios antiguos

alter table public.social_comments
  add column if not exists body text,
  add column if not exists content text,
  add column if not exists username text;

update public.social_comments
set body = coalesce(body, content, '')
where body is null;

update public.social_comments
set content = coalesce(content, body, '')
where content is null;

update public.social_comments c
set username = coalesce(nullif(p.username, ''), nullif(p.full_name, ''), 'Usuario')
from public.profiles p
where p.id = c.user_id
  and (c.username is null or btrim(c.username) = '');

update public.social_comments
set username = 'Usuario'
where username is null or btrim(username) = '';

alter table public.social_comments
  alter column body set default '',
  alter column content set default '',
  alter column username set default 'Usuario';

notify pgrst, 'reload schema';
