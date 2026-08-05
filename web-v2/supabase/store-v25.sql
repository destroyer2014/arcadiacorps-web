-- ArcadiaCorps Store v25.1 - compatible con tablas antiguas que ya usan is_active
create table if not exists public.store_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  label text,
  price numeric(10,2) not null check (price >= 0),
  old_price numeric(10,2),
  badge text,
  logo_url text,
  rating text default '4.9',
  sales_text text default '',
  featured boolean not null default false,
  sold_out boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_offers (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Compatibilidad: si una instalación anterior creó active, copiar sus valores.
alter table public.store_products add column if not exists is_active boolean not null default true;
alter table public.store_offers add column if not exists is_active boolean not null default true;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='store_products' and column_name='active'
  ) then
    execute 'update public.store_products set is_active = active where active is not null';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='store_offers' and column_name='active'
  ) then
    execute 'update public.store_offers set is_active = active where active is not null';
  end if;
end $$;

alter table public.store_products enable row level security;
alter table public.store_offers enable row level security;

drop policy if exists "store products public read" on public.store_products;
drop policy if exists "store_products_read_active" on public.store_products;
drop policy if exists "store products owner all" on public.store_products;
drop policy if exists "store_products_owner_all" on public.store_products;

create policy "store products public read"
on public.store_products for select to authenticated
using (
  is_active = true
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role::text = 'owner'
  )
);

create policy "store products owner all"
on public.store_products for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role::text = 'owner'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role::text = 'owner'
  )
);

drop policy if exists "store offers public read" on public.store_offers;
drop policy if exists "store_offers_read_active" on public.store_offers;
drop policy if exists "store offers owner all" on public.store_offers;
drop policy if exists "store_offers_owner_all" on public.store_offers;

create policy "store offers public read"
on public.store_offers for select to authenticated
using (
  is_active = true
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role::text = 'owner'
  )
);

create policy "store offers owner all"
on public.store_offers for all to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role::text = 'owner'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role::text = 'owner'
  )
);

notify pgrst, 'reload schema';
