-- ArcadiaCorps Store dinámica v14
-- Ejecutar una sola vez en Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.store_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null default 'streaming',
  description text,
  price numeric(10,2) not null check (price >= 0),
  old_price numeric(10,2) check (old_price is null or old_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  badge text,
  tabs text[] not null default array['tendencias']::text[],
  logo_url text,
  whatsapp_message text,
  rating numeric(2,1) not null default 4.9 check (rating between 0 and 5),
  sales_count integer not null default 0 check (sales_count >= 0),
  is_featured boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_products_public_idx
  on public.store_products(is_active, sort_order, created_at desc);
create index if not exists store_products_category_idx
  on public.store_products(category);

create or replace function public.touch_store_product()
returns trigger language plpgsql set search_path=public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_store_product on public.store_products;
create trigger trg_touch_store_product before update on public.store_products
for each row execute function public.touch_store_product();

alter table public.store_products enable row level security;

drop policy if exists store_products_public_read on public.store_products;
create policy store_products_public_read on public.store_products
for select to anon, authenticated
using (is_active = true or public.current_app_role_v12() = 'owner');

drop policy if exists store_products_owner_insert on public.store_products;
create policy store_products_owner_insert on public.store_products
for insert to authenticated
with check (public.current_app_role_v12() = 'owner' and created_by = auth.uid());

drop policy if exists store_products_owner_update on public.store_products;
create policy store_products_owner_update on public.store_products
for update to authenticated
using (public.current_app_role_v12() = 'owner')
with check (public.current_app_role_v12() = 'owner' and updated_by = auth.uid());

drop policy if exists store_products_owner_delete on public.store_products;
create policy store_products_owner_delete on public.store_products
for delete to authenticated
using (public.current_app_role_v12() = 'owner');

grant select on public.store_products to anon, authenticated;
grant insert, update, delete on public.store_products to authenticated;

insert into public.store_products
(slug,name,category,description,price,old_price,stock,badge,tabs,logo_url,whatsapp_message,rating,sales_count,is_featured,is_active,sort_order)
values
('netflix-premium-1-pantalla','Netflix Premium 1 Pantalla','streaming','Acceso premium para una pantalla.',15,20,12,'-25%',array['tendencias','vendidos'],'assets/logos/netflix.svg','Hola, quiero comprar Netflix Premium 1 Pantalla',4.9,120,true,true,10),
('hbo-max-premium','HBO Max Premium','streaming','Entretenimiento premium en HBO Max.',14,18,0,'Agotado',array['vendidos'],'assets/logos/hbo-max.svg','Hola, quiero consultar stock de HBO Max Premium',4.8,70,false,true,20),
('canva-pro','Canva Pro','software','Herramientas premium para diseño y contenido.',18,25,10,'-28%',array['tendencias','nuevos'],'assets/logos/canva.svg','Hola, quiero comprar Canva Pro',4.9,100,true,true,30),
('prime-video','Prime Video','streaming','Catálogo de películas y series de Prime Video.',12,14,15,'-25%',array['tendencias','ofertas'],'assets/logos/prime-video.svg','Hola, quiero comprar Prime Video',4.9,120,true,true,40),
('disney-plus-premium','Disney+ Premium','streaming','Disney, Pixar, Marvel y más.',16,22,9,'-27%',array['vendidos','ofertas'],'assets/logos/disney-plus.svg','Hola, quiero comprar Disney+ Premium',4.9,95,false,true,50),
('spotify-premium-individual','Spotify Premium Individual','musica','Música sin anuncios en una cuenta individual.',10,14,18,'-29%',array['vendidos'],'assets/logos/spotify.svg','Hola, quiero comprar Spotify Premium Individual',4.9,120,false,true,60),
('cuenta-dyver','Cuenta Dyver','servicios','Servicio digital con entrega asistida.',20,30,5,'Digital',array['nuevos'],'assets/logos/dyver.svg','Hola, quiero comprar una Cuenta Dyver',4.9,45,false,true,70),
('duolingo-super','Duolingo Super','educacion','Aprendizaje de idiomas sin anuncios.',18,22,8,'-20%',array['nuevos','ofertas'],'assets/logos/duolingo.svg','Hola, quiero comprar Duolingo Super',4.8,54,false,true,80),
('crunchyroll-mega-fan','Crunchyroll Mega Fan','streaming','Anime premium con beneficios Mega Fan.',11,15,10,'Nuevo',array['nuevos'],'assets/logos/crunchyroll.svg','Hola, quiero comprar Crunchyroll Mega Fan',4.8,40,false,true,90)
on conflict (slug) do nothing;

select count(*) as store_products_ready from public.store_products;
