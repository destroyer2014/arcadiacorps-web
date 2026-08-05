-- ArcadiaCorps Social v27
create extension if not exists pgcrypto;
create table if not exists public.social_posts(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,body text not null check(char_length(body) between 1 and 3000),image_path text,is_featured boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.social_post_likes(post_id uuid not null references public.social_posts(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,created_at timestamptz not null default now(),primary key(post_id,user_id));
create table if not exists public.social_comments(id uuid primary key default gen_random_uuid(),post_id uuid not null references public.social_posts(id) on delete cascade,user_id uuid not null references public.profiles(id) on delete cascade,body text not null check(char_length(body) between 1 and 800),created_at timestamptz not null default now());
create table if not exists public.social_stories(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,body text not null check(char_length(body) between 1 and 300),background text not null default 'blue-purple',image_path text,created_at timestamptz not null default now(),expires_at timestamptz not null default(now()+interval '24 hours'));

alter table public.social_posts enable row level security;alter table public.social_post_likes enable row level security;alter table public.social_comments enable row level security;alter table public.social_stories enable row level security;
grant select,insert,update,delete on public.social_posts,public.social_post_likes,public.social_comments,public.social_stories to authenticated;
drop policy if exists social_profiles_visible on public.profiles;create policy social_profiles_visible on public.profiles for select to authenticated using(true);
drop policy if exists posts_read on public.social_posts;create policy posts_read on public.social_posts for select to authenticated using(true);
drop policy if exists posts_insert on public.social_posts;create policy posts_insert on public.social_posts for insert to authenticated with check(user_id=auth.uid());
drop policy if exists posts_update on public.social_posts;create policy posts_update on public.social_posts for update to authenticated using(user_id=auth.uid() or public.current_user_role() in ('owner','staff')) with check(user_id=auth.uid() or public.current_user_role() in ('owner','staff'));
drop policy if exists posts_delete on public.social_posts;create policy posts_delete on public.social_posts for delete to authenticated using(user_id=auth.uid() or public.current_user_role() in ('owner','staff'));
drop policy if exists likes_read on public.social_post_likes;create policy likes_read on public.social_post_likes for select to authenticated using(true);
drop policy if exists likes_insert on public.social_post_likes;create policy likes_insert on public.social_post_likes for insert to authenticated with check(user_id=auth.uid());
drop policy if exists likes_delete on public.social_post_likes;create policy likes_delete on public.social_post_likes for delete to authenticated using(user_id=auth.uid());
drop policy if exists comments_read on public.social_comments;create policy comments_read on public.social_comments for select to authenticated using(true);
drop policy if exists comments_insert on public.social_comments;create policy comments_insert on public.social_comments for insert to authenticated with check(user_id=auth.uid());
drop policy if exists comments_delete on public.social_comments;create policy comments_delete on public.social_comments for delete to authenticated using(user_id=auth.uid() or public.current_user_role() in ('owner','staff'));
drop policy if exists stories_read on public.social_stories;create policy stories_read on public.social_stories for select to authenticated using(expires_at>now());
drop policy if exists stories_insert on public.social_stories;create policy stories_insert on public.social_stories for insert to authenticated with check(user_id=auth.uid());
drop policy if exists stories_delete on public.social_stories;create policy stories_delete on public.social_stories for delete to authenticated using(user_id=auth.uid() or public.current_user_role() in ('owner','staff'));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('social-media','social-media',false,8388608,array['image/jpeg','image/png','image/webp','image/gif']) on conflict(id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists social_media_read on storage.objects;create policy social_media_read on storage.objects for select to authenticated using(bucket_id='social-media');
drop policy if exists social_media_insert on storage.objects;create policy social_media_insert on storage.objects for insert to authenticated with check(bucket_id='social-media' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists social_media_delete on storage.objects;create policy social_media_delete on storage.objects for delete to authenticated using(bucket_id='social-media' and ((storage.foldername(name))[1]=auth.uid()::text or public.current_user_role() in ('owner','staff')));
notify pgrst,'reload schema';
