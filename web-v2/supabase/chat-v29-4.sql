-- ArcadiaCorps Chat v29.4: soporte para respuestas/citas
alter table public.arc_chat_messages
add column if not exists reply_to uuid
references public.arc_chat_messages(id)
on delete set null;

notify pgrst, 'reload schema';
