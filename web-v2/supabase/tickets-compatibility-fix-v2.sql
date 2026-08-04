-- Compatibilidad de tickets antiguos con ArcadiaCorps Web 2.0
-- Agrega al enum existente los valores usados por la interfaz nueva.
alter type public.ticket_priority add value if not exists 'low';
alter type public.ticket_priority add value if not exists 'normal';
alter type public.ticket_priority add value if not exists 'high';
alter type public.ticket_priority add value if not exists 'urgent';

-- Asegura que las columnas modernas existan sin borrar datos antiguos.
alter table public.tickets add column if not exists description text;
alter table public.ticket_messages add column if not exists ticket_id uuid;
alter table public.ticket_messages add column if not exists author_id uuid;
alter table public.ticket_messages add column if not exists body text;
alter table public.ticket_messages add column if not exists attachments text[] default '{}';

notify pgrst, 'reload schema';
