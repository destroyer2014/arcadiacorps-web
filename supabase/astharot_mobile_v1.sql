-- Astharot RPG Mobile v1: posición, maná y guardado del prototipo 2D.
alter table public.astharot_characters
  add column if not exists map_x integer not null default 600,
  add column if not exists map_y integer not null default 520,
  add column if not exists max_mana integer,
  add column if not exists mana integer;

update public.astharot_characters
set max_mana = coalesce(max_mana, case class when 'mage' then 90 when 'assassin' then 60 else 45 end),
    mana = coalesce(mana, case class when 'mage' then 90 when 'assassin' then 60 else 45 end)
where max_mana is null or mana is null;

alter table public.astharot_characters alter column max_mana set not null;
alter table public.astharot_characters alter column mana set not null;

create or replace function public.astharot_mobile_save(p_x integer,p_y integer,p_hp integer,p_mana integer)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  update public.astharot_characters set
    map_x=greatest(20,least(1880,p_x)), map_y=greatest(20,least(1280,p_y)),
    hp=greatest(0,least(max_hp,p_hp)), mana=greatest(0,least(max_mana,p_mana)), updated_at=now()
  where user_id=auth.uid();
end $$;
grant execute on function public.astharot_mobile_save(integer,integer,integer,integer) to authenticated;

create or replace function public.astharot_mobile_reward(p_gold integer,p_xp integer,p_hp integer,p_mana integer,p_x integer,p_y integer)
returns public.astharot_characters language plpgsql security definer set search_path=public as $$
declare c public.astharot_characters%rowtype; need integer;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  if p_gold not between 0 and 25 or p_xp not between 0 and 35 then raise exception 'Recompensa inválida'; end if;
  select * into c from public.astharot_characters where user_id=auth.uid() for update;
  c.gold:=c.gold+p_gold; c.experience:=c.experience+p_xp; c.wins:=c.wins+1;
  need:=c.level*100;
  if c.experience>=need then c.experience:=c.experience-need;c.level:=c.level+1;c.max_hp:=c.max_hp+12;c.attack:=c.attack+3;c.defense:=c.defense+2;c.speed:=c.speed+1;c.hp:=c.max_hp; end if;
  update public.astharot_characters set level=c.level,experience=c.experience,gold=c.gold,wins=c.wins,max_hp=c.max_hp,hp=greatest(0,least(c.max_hp,p_hp)),attack=c.attack,defense=c.defense,speed=c.speed,mana=greatest(0,least(max_mana,p_mana)),map_x=greatest(20,least(1880,p_x)),map_y=greatest(20,least(1280,p_y)),updated_at=now() where id=c.id returning * into c;
  return c;
end $$;
grant execute on function public.astharot_mobile_reward(integer,integer,integer,integer,integer,integer) to authenticated;

select to_regclass('public.astharot_characters') as astharot_mobile_ready;
