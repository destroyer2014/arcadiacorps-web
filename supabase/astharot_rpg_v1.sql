-- Astharot RPG v1 — personaje único, progresión y combate seguro.
create table if not exists public.astharot_characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 18),
  class text not null check (class in ('warrior','mage','assassin')),
  level integer not null default 1 check (level >= 1),
  experience integer not null default 0 check (experience >= 0),
  gold integer not null default 50 check (gold >= 0),
  energy integer not null default 10 check (energy between 0 and 10),
  max_hp integer not null,
  hp integer not null,
  attack integer not null,
  defense integer not null,
  speed integer not null,
  crit_chance integer not null,
  potions integer not null default 2 check (potions >= 0),
  wins integer not null default 0,
  defeats integer not null default 0,
  last_energy_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.astharot_characters enable row level security;
drop policy if exists astharot_character_read_own on public.astharot_characters;
create policy astharot_character_read_own on public.astharot_characters for select to authenticated using (user_id=auth.uid());
revoke insert, update, delete on public.astharot_characters from anon, authenticated;
grant select on public.astharot_characters to authenticated;

create or replace function public.astharot_create_character(p_name text,p_class text)
returns setof public.astharot_characters
language plpgsql security definer set search_path=public
as $$
declare s record;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  if exists(select 1 from public.astharot_characters where user_id=auth.uid()) then raise exception 'Ya tienes un personaje'; end if;
  if char_length(trim(p_name)) not between 3 and 18 then raise exception 'Nombre inválido'; end if;
  if p_class='warrior' then s:=row(130,18,14,8,8);
  elsif p_class='mage' then s:=row(90,25,7,12,10);
  elsif p_class='assassin' then s:=row(105,22,8,18,18);
  else raise exception 'Clase inválida'; end if;
  return query insert into public.astharot_characters(user_id,name,class,max_hp,hp,attack,defense,speed,crit_chance)
  values(auth.uid(),trim(p_name),p_class,s.f1,s.f1,s.f2,s.f3,s.f4,s.f5) returning *;
end $$;
grant execute on function public.astharot_create_character(text,text) to authenticated;

create or replace function public.astharot_battle(p_action text,p_enemy jsonb default null)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare c public.astharot_characters%rowtype;e jsonb;enemy_hp int;enemy_max int;enemy_attack int;enemy_def int;dmg int;enemy_dmg int;crit boolean;reward_gold int;reward_xp int;need int;logs jsonb='[]'::jsonb;result text='ongoing';roll float;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  select * into c from public.astharot_characters where user_id=auth.uid() for update;
  if not found then raise exception 'Crea tu personaje primero'; end if;
  -- Recuperación sencilla: 1 energía cada 10 minutos.
  if c.energy<10 then
    c.energy:=least(10,c.energy+floor(extract(epoch from(now()-c.last_energy_at))/600)::int);
    if c.energy>0 then c.last_energy_at:=now(); end if;
  end if;
  if p_action='explore' then
    if c.energy<1 then raise exception 'No tienes energía'; end if;
    c.energy:=c.energy-1;c.last_energy_at:=now();roll:=random();
    if roll<.25 then e:=jsonb_build_object('id','slime','name','Limo Oscuro','sprite','🟣','description','Una masa corrupta bloquea el sendero.','level',c.level,'max_hp',45+c.level*7,'hp',45+c.level*7,'attack',8+c.level*2,'defense',3+c.level,'gold',12+c.level*2,'xp',22+c.level*4);
    elsif roll<.5 then e:=jsonb_build_object('id','wolf','name','Lobo Salvaje','sprite','🐺','description','Sus ojos brillan entre la niebla.','level',c.level,'max_hp',58+c.level*8,'hp',58+c.level*8,'attack',11+c.level*2,'defense',4+c.level,'gold',16+c.level*2,'xp',28+c.level*4);
    elsif roll<.75 then e:=jsonb_build_object('id','bandit','name','Bandido del Camino','sprite','🥷','description','Exige tu oro con la espada en alto.','level',c.level,'max_hp',68+c.level*9,'hp',68+c.level*9,'attack',13+c.level*2,'defense',6+c.level,'gold',22+c.level*3,'xp',35+c.level*5);
    else e:=jsonb_build_object('id','skeleton','name','Esqueleto Errante','sprite','💀','description','Un antiguo soldado despierta entre cenizas.','level',c.level+1,'max_hp',78+c.level*10,'hp',78+c.level*10,'attack',15+c.level*2,'defense',8+c.level,'gold',28+c.level*3,'xp',42+c.level*6);end if;
    update public.astharot_characters set energy=c.energy,last_energy_at=c.last_energy_at,updated_at=now() where id=c.id returning * into c;
    return jsonb_build_object('character',to_jsonb(c),'enemy',e,'result','encounter','log',jsonb_build_array('Has encontrado a '||(e->>'name')||'.'));
  end if;
  if p_enemy is null then raise exception 'No hay enemigo activo'; end if;e:=p_enemy;enemy_hp=(e->>'hp')::int;enemy_max=(e->>'max_hp')::int;enemy_attack=(e->>'attack')::int;enemy_def=(e->>'defense')::int;
  if p_action='potion' then
    if c.potions<1 then raise exception 'No tienes pociones'; end if;c.potions:=c.potions-1;c.hp:=least(c.max_hp,c.hp+45);logs:=logs||jsonb_build_array('Usaste una poción y recuperaste vida.');
  elsif p_action='attack' then
    crit=random()*100<c.crit_chance;dmg:=greatest(1,c.attack-enemy_def/2+floor(random()*7)::int);if crit then dmg:=floor(dmg*1.7);end if;enemy_hp:=greatest(0,enemy_hp-dmg);logs:=logs||jsonb_build_array('Atacaste e infligiste '||dmg||case when crit then ' de daño crítico.' else ' de daño.' end);
  else raise exception 'Acción inválida'; end if;
  if enemy_hp>0 then enemy_dmg:=greatest(1,enemy_attack-c.defense/2+floor(random()*5)::int);c.hp:=greatest(0,c.hp-enemy_dmg);logs:=logs||jsonb_build_array((e->>'name')||' te golpeó por '||enemy_dmg||'.');end if;
  if enemy_hp<=0 then
    result:='victory';reward_gold=(e->>'gold')::int;reward_xp=(e->>'xp')::int;c.gold:=c.gold+reward_gold;c.experience:=c.experience+reward_xp;c.wins:=c.wins+1;need:=c.level*100;
    while c.experience>=need loop c.experience:=c.experience-need;c.level:=c.level+1;c.max_hp:=c.max_hp+12;c.attack:=c.attack+3;c.defense:=c.defense+2;c.speed:=c.speed+1;c.hp:=c.max_hp;logs:=logs||jsonb_build_array('¡Subiste al nivel '||c.level||'!');need:=c.level*100;end loop;e:=null;
  elsif c.hp<=0 then result:='defeat';c.defeats:=c.defeats+1;c.hp:=c.max_hp;e:=null;end if;
  update public.astharot_characters set level=c.level,experience=c.experience,gold=c.gold,energy=c.energy,max_hp=c.max_hp,hp=c.hp,attack=c.attack,defense=c.defense,speed=c.speed,crit_chance=c.crit_chance,potions=c.potions,wins=c.wins,defeats=c.defeats,last_energy_at=c.last_energy_at,updated_at=now() where id=c.id returning * into c;
  if e is not null then e:=jsonb_set(e,'{hp}',to_jsonb(enemy_hp));end if;
  return jsonb_build_object('character',to_jsonb(c),'enemy',e,'result',result,'rewards',jsonb_build_object('gold',coalesce(reward_gold,0),'experience',coalesce(reward_xp,0)),'log',logs);
end $$;
grant execute on function public.astharot_battle(text,jsonb) to authenticated;

select to_regclass('public.astharot_characters') as astharot_ready;
