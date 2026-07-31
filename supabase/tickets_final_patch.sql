-- Parche final para habilitar la gestión de roles desde el Panel Owner.
-- Ejecutar una sola vez en Supabase > SQL Editor.

grant select, update on public.profiles to authenticated;

grant select, insert, update, delete on public.tickets to authenticated;
grant select, insert on public.ticket_messages to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;
grant select, insert, update on public.notification_reads to authenticated;
grant usage, select on all sequences in schema public to authenticated;

select
  has_table_privilege('authenticated', 'public.profiles', 'UPDATE') as owner_can_update_roles,
  has_table_privilege('authenticated', 'public.notifications', 'INSERT') as can_publish_notifications,
  has_table_privilege('authenticated', 'public.tickets', 'UPDATE') as staff_can_update_tickets;
