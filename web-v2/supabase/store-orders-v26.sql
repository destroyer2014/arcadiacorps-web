-- ArcadiaCorps Web 2.0 - Pedidos reales de tienda v26
create extension if not exists pgcrypto;

-- Asegura nombres compatibles de la tienda v25.1
alter table public.store_products add column if not exists is_active boolean not null default true;
alter table public.store_offers add column if not exists is_active boolean not null default true;

create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','paid','processing','delivered','cancelled','refunded')),
  currency text not null default 'PEN',
  total_amount numeric(10,2) not null default 0 check (total_amount >= 0),
  item_count integer not null default 0 check (item_count >= 0),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_orders(id) on delete cascade,
  product_id uuid references public.store_products(id) on delete set null,
  product_name text not null,
  category text,
  logo_url text,
  unit_price numeric(10,2) not null check (unit_price >= 0),
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now()
);

create index if not exists store_orders_user_created_idx on public.store_orders(user_id, created_at desc);
create index if not exists store_order_items_order_idx on public.store_order_items(order_id);

alter table public.store_orders enable row level security;
alter table public.store_order_items enable row level security;

drop policy if exists "users read own store orders" on public.store_orders;
create policy "users read own store orders" on public.store_orders for select to authenticated
using (user_id = auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text in ('owner','staff')));

drop policy if exists "staff update store orders" on public.store_orders;
create policy "staff update store orders" on public.store_orders for update to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text in ('owner','staff')))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text in ('owner','staff')));

drop policy if exists "users read own store order items" on public.store_order_items;
create policy "users read own store order items" on public.store_order_items for select to authenticated
using (exists(select 1 from public.store_orders o where o.id=order_id and (o.user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text in ('owner','staff')))));

create or replace function public.create_store_order(product_ids uuid[])
returns table(order_id uuid, order_number text, total_amount numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_order_id uuid;
  new_order_number text;
  computed_total numeric(10,2);
  computed_count integer;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  if product_ids is null or cardinality(product_ids)=0 then raise exception 'El carrito está vacío'; end if;

  select coalesce(sum(price),0), count(*)
  into computed_total, computed_count
  from public.store_products
  where id = any(product_ids) and is_active=true and sold_out=false;

  if computed_count <> cardinality(product_ids) then
    raise exception 'Uno o más productos no están disponibles';
  end if;

  new_order_number := 'AC-' || to_char(clock_timestamp(),'YYMMDD-HH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));
  insert into public.store_orders(order_number,user_id,total_amount,item_count)
  values(new_order_number,auth.uid(),computed_total,computed_count)
  returning id into new_order_id;

  insert into public.store_order_items(order_id,product_id,product_name,category,logo_url,unit_price)
  select new_order_id,id,name,category,logo_url,price
  from public.store_products
  where id = any(product_ids) and is_active=true and sold_out=false;

  return query select new_order_id,new_order_number,computed_total;
end;
$$;

revoke all on function public.create_store_order(uuid[]) from public;
grant execute on function public.create_store_order(uuid[]) to authenticated;

notify pgrst, 'reload schema';
