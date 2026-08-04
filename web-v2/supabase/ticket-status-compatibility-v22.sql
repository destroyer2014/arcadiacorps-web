-- Compatibilidad del enum de estados con ArcadiaCorps Web 2.0
-- No elimina valores anteriores ni datos existentes.
alter type public.ticket_status add value if not exists 'open';
alter type public.ticket_status add value if not exists 'in_progress';
alter type public.ticket_status add value if not exists 'waiting_user';
alter type public.ticket_status add value if not exists 'closed';

notify pgrst, 'reload schema';
