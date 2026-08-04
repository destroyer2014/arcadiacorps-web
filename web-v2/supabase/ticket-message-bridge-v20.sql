-- ArcadiaCorps Web 2.0 - compatibilidad de mensajes de tickets v20
-- Completa automáticamente las columnas antiguas y nuevas antes de insertar.

create or replace function public.ticket_messages_compat_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Resolver la relación en ambos sentidos.
  if new.ticket_id is null and new.ticket_number is not null then
    select t.id
      into new.ticket_id
    from public.tickets t
    where t.ticket_number = new.ticket_number
    limit 1;
  end if;

  if new.ticket_number is null and new.ticket_id is not null then
    select t.ticket_number
      into new.ticket_number
    from public.tickets t
    where t.id = new.ticket_id
    limit 1;
  end if;

  -- Sincronizar autor y contenido entre el esquema antiguo y el nuevo.
  new.author_id := coalesce(new.author_id, new.sender_id);
  new.sender_id := coalesce(new.sender_id, new.author_id);
  new.body := coalesce(new.body, new.message);
  new.message := coalesce(new.message, new.body);
  new.attachments := coalesce(new.attachments, '{}'::text[]);
  new.is_internal := coalesce(new.is_internal, false);

  if new.ticket_id is null then
    raise exception 'No se pudo resolver ticket_id para el mensaje del ticket';
  end if;

  return new;
end;
$$;

drop trigger if exists ticket_messages_compat_before_insert_trigger
on public.ticket_messages;

create trigger ticket_messages_compat_before_insert_trigger
before insert or update on public.ticket_messages
for each row
execute function public.ticket_messages_compat_before_insert();

-- Reparar filas previas que todavía puedan estar incompletas.
update public.ticket_messages m
set ticket_id = t.id
from public.tickets t
where m.ticket_id is null
  and m.ticket_number = t.ticket_number;

update public.ticket_messages
set
  author_id = coalesce(author_id, sender_id),
  sender_id = coalesce(sender_id, author_id),
  body = coalesce(body, message),
  message = coalesce(message, body),
  attachments = coalesce(attachments, '{}'::text[]);

notify pgrst, 'reload schema';
