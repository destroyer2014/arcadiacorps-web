-- ArcadiaCorps Web 2.0 — Noticias y anuncios reales
create extension if not exists pgcrypto;

create table if not exists public.news_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 160),
  slug text not null unique,
  excerpt text not null default '' check (char_length(excerpt) <= 320),
  content text not null check (char_length(content) >= 20),
  cover_url text,
  external_url text,
  status text not null default 'draft' check (status in ('draft','published')),
  is_pinned boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.news_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.news_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 2 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists news_posts_published_idx on public.news_posts(status,is_pinned,published_at desc);
create index if not exists news_comments_post_idx on public.news_comments(post_id,created_at);

alter table public.news_posts enable row level security;
alter table public.news_comments enable row level security;

drop policy if exists news_posts_read_published on public.news_posts;
drop policy if exists news_posts_staff_all on public.news_posts;
drop policy if exists news_posts_staff_insert on public.news_posts;
drop policy if exists news_posts_staff_update on public.news_posts;
drop policy if exists news_posts_staff_delete on public.news_posts;

create policy news_posts_read_published on public.news_posts for select to authenticated using (
  status = 'published' or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text in ('owner','staff'))
);
create policy news_posts_staff_insert on public.news_posts for insert to authenticated with check (
  author_id=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text in ('owner','staff'))
);
create policy news_posts_staff_update on public.news_posts for update to authenticated using (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text in ('owner','staff'))
) with check (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text in ('owner','staff'))
);
create policy news_posts_staff_delete on public.news_posts for delete to authenticated using (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text in ('owner','staff'))
);

drop policy if exists news_comments_read on public.news_comments;
drop policy if exists news_comments_insert on public.news_comments;
drop policy if exists news_comments_delete on public.news_comments;
create policy news_comments_read on public.news_comments for select to authenticated using (true);
create policy news_comments_insert on public.news_comments for insert to authenticated with check (user_id=auth.uid());
create policy news_comments_delete on public.news_comments for delete to authenticated using (
  user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text in ('owner','staff'))
);

grant select,insert,update,delete on public.news_posts to authenticated;
grant select,insert,update,delete on public.news_comments to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('news-images','news-images',true,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists news_images_public_read on storage.objects;
drop policy if exists news_images_staff_insert on storage.objects;
drop policy if exists news_images_staff_update on storage.objects;
drop policy if exists news_images_staff_delete on storage.objects;
create policy news_images_public_read on storage.objects for select using (bucket_id='news-images');
create policy news_images_staff_insert on storage.objects for insert to authenticated with check (
  bucket_id='news-images' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text in ('owner','staff'))
);
create policy news_images_staff_update on storage.objects for update to authenticated using (
  bucket_id='news-images' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text in ('owner','staff'))
);
create policy news_images_staff_delete on storage.objects for delete to authenticated using (
  bucket_id='news-images' and (storage.foldername(name))[1]=auth.uid()::text and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text in ('owner','staff'))
);

notify pgrst, 'reload schema';
