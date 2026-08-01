-- ArcadiaCorps v15 — Novedades y configuración general
-- Ejecutar una sola vez en Supabase SQL Editor.

create table if not exists public.site_news (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 140),
  summary text not null check (char_length(summary) between 2 and 600),
  badge text not null default 'Nuevo' check (char_length(badge) between 1 and 30),
  action_label text check (action_label is null or char_length(action_label) <= 40),
  action_url text check (action_url is null or char_length(action_url) <= 400),
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_news_dates_ok check (expires_at is null or starts_at is null or expires_at > starts_at)
);

create table if not exists public.site_settings (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  value text not null default '',
  label text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists site_news_public_idx
  on public.site_news (is_active, sort_order, created_at desc);

create or replace function public.touch_site_content_v15()
returns trigger language plpgsql set search_path=public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_site_news_v15 on public.site_news;
create trigger trg_touch_site_news_v15 before update on public.site_news
for each row execute function public.touch_site_content_v15();

drop trigger if exists trg_touch_site_settings_v15 on public.site_settings;
create trigger trg_touch_site_settings_v15 before update on public.site_settings
for each row execute function public.touch_site_content_v15();

alter table public.site_news enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists site_news_public_read_v15 on public.site_news;
create policy site_news_public_read_v15 on public.site_news
for select to anon, authenticated
using (
  is_active = true
  and (starts_at is null or starts_at <= now())
  and (expires_at is null or expires_at > now())
  or public.current_app_role_v12() = 'owner'
);

drop policy if exists site_news_owner_insert_v15 on public.site_news;
create policy site_news_owner_insert_v15 on public.site_news
for insert to authenticated
with check (public.current_app_role_v12() = 'owner' and created_by = auth.uid());

drop policy if exists site_news_owner_update_v15 on public.site_news;
create policy site_news_owner_update_v15 on public.site_news
for update to authenticated
using (public.current_app_role_v12() = 'owner')
with check (public.current_app_role_v12() = 'owner');

drop policy if exists site_news_owner_delete_v15 on public.site_news;
create policy site_news_owner_delete_v15 on public.site_news
for delete to authenticated
using (public.current_app_role_v12() = 'owner');

drop policy if exists site_settings_public_read_v15 on public.site_settings;
create policy site_settings_public_read_v15 on public.site_settings
for select to anon, authenticated using (true);

drop policy if exists site_settings_owner_insert_v15 on public.site_settings;
create policy site_settings_owner_insert_v15 on public.site_settings
for insert to authenticated
with check (public.current_app_role_v12() = 'owner');

drop policy if exists site_settings_owner_update_v15 on public.site_settings;
create policy site_settings_owner_update_v15 on public.site_settings
for update to authenticated
using (public.current_app_role_v12() = 'owner')
with check (public.current_app_role_v12() = 'owner');

grant select on public.site_news, public.site_settings to anon, authenticated;
grant insert, update, delete on public.site_news to authenticated;
grant insert, update on public.site_settings to authenticated;

insert into public.site_settings(key,value,label) values
 ('whatsapp_number','51917611323','Número de WhatsApp'),
 ('hero_eyebrow','El bot todo en uno para WhatsApp','Etiqueta del inicio'),
 ('hero_title','PRAGMATA','Título principal'),
 ('hero_accent','BOT','Texto destacado'),
 ('hero_description','Más de 300 comandos diseñados para hacer crecer tu grupo de WhatsApp, administrar, entretener y automatizar tu comunidad.','Descripción principal'),
 ('primary_button_text','Ver comandos','Botón principal'),
 ('primary_button_url','comandos.html','Enlace botón principal'),
 ('secondary_button_text','Hazte premium','Botón secundario'),
 ('secondary_button_url','premium.html','Enlace botón secundario'),
 ('service_status','online','Estado del servicio'),
 ('service_status_label','En línea','Texto del estado'),
 ('service_status_message','Todos los sistemas funcionan correctamente.','Detalle del estado'),
 ('maintenance_enabled','false','Modo mantenimiento'),
 ('maintenance_message','Estamos realizando mejoras. Volveremos pronto.','Mensaje de mantenimiento'),
 ('whatsapp_channel_url','https://whatsapp.com/channel/0029VbADsUx6LwHo4wdirM0v','Canal de WhatsApp'),
 ('whatsapp_group_url','https://chat.whatsapp.com/GnLsSfMP0Sd1qO1h2vMqnA','Grupo de WhatsApp')
on conflict (key) do nothing;

insert into public.site_news(title,summary,badge,action_label,action_url,is_active,sort_order)
select * from (values
 ('Sistema de economía renovado','Gestiona tu dinero y haz crecer tu comunidad.','Nuevo','Ver proyecto','proyecto.html',true,10),
 ('Nuevos juegos de casino','Más diversión, retos y premios para todos.','Nuevo','Explorar casino','casino.html',true,20),
 ('IA más rápida','Respuestas más precisas y útiles en menos tiempo.','Mejorado','Ver comandos','comandos.html',true,30),
 ('Tickets dentro de la web','Habla directamente con nuestro equipo de soporte.','Soporte','Abrir soporte','soporte.html',true,40)
) as seed(title,summary,badge,action_label,action_url,is_active,sort_order)
where not exists (select 1 from public.site_news);

select
  (select count(*) from public.site_news) as site_news_ready,
  (select count(*) from public.site_settings) as site_settings_ready;
