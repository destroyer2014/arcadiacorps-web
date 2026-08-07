import { supabase } from './auth.js';

let controllerPromise;

function fmtLastSeen(value) {
  if (!value) return 'Sin actividad registrada';
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return 'Activo hace unos segundos';
  if (diff < 3_600_000) return `Activo hace ${Math.max(1,Math.floor(diff/60_000))} min`;
  if (diff < 86_400_000) return `Activo hace ${Math.floor(diff/3_600_000)} h`;
  return `Última vez: ${date.toLocaleString('es-PE')}`;
}

async function initPresence() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const user = session.user;
  let visible = true;
  let online = new Set();
  let channel = null;
  let touchTimer = null;
  let socialTimer = null;
  const postUsers = new Map();

  try {
    const { data } = await supabase.rpc('arc_presence_snapshot',{ target_ids:[user.id] });
    const own = Array.isArray(data) ? data[0] : null;
    if (own) visible = own.presence_visible !== false;
  } catch {}

  const dispatch = () => {
    document.querySelectorAll('[data-presence-user]').forEach(node => {
      const id = node.dataset.presenceUser;
      const isOnline = online.has(id);
      node.classList.toggle('online',isOnline);
      node.classList.toggle('offline',!isOnline);
      node.title = isOnline ? 'En línea' : 'Desconectado';
    });

    const sidebarText = document.querySelector('#sidebarPresenceText');
    if (sidebarText) {
      sidebarText.textContent = visible
        ? (online.has(user.id) ? 'En línea' : 'Conectando…')
        : 'Estado oculto';
    }

    window.dispatchEvent(new CustomEvent('arcadia:presence',{
      detail:{ online:new Set(online),visible,userId:user.id }
    }));
  };

  const touch = async () => {
    try { await supabase.rpc('arc_touch_presence'); } catch {}
  };

  const connect = async () => {
    if (channel) {
      try { await supabase.removeChannel(channel); } catch {}
    }

    channel = supabase.channel('arc-chat-presence',{
      config:{ presence:{ key:user.id } }
    });

    channel
      .on('presence',{ event:'sync' },() => {
        const state = channel.presenceState();
        online = new Set(Object.keys(state));
        dispatch();
      })
      .on('presence',{ event:'join' },dispatch)
      .on('presence',{ event:'leave' },dispatch)
      .subscribe(async status => {
        if (status === 'SUBSCRIBED' && visible) {
          await channel.track({
            user_id:user.id,
            online_at:new Date().toISOString(),
            page:location.pathname
          });
        }
      });
  };

  async function setVisibility(next) {
    const wanted = Boolean(next);
    const { error } = await supabase.rpc('arc_set_presence_visibility',{
      new_value:wanted
    });
    if (error) throw error;

    visible = wanted;
    if (channel) {
      if (visible) {
        await channel.track({
          user_id:user.id,
          online_at:new Date().toISOString(),
          page:location.pathname
        });
      } else {
        await channel.untrack();
      }
    }
    dispatch();
    return visible;
  }

  async function snapshot(ids) {
    const clean = [...new Set((ids || []).filter(Boolean))].slice(0,200);
    if (!clean.length) return [];
    const { data,error } = await supabase.rpc('arc_presence_snapshot',{
      target_ids:clean
    });
    if (error) throw error;
    return data || [];
  }

  async function bindSocialPosts() {
    if (!location.pathname.endsWith('/social.html')) return;
    const cards = [...document.querySelectorAll('.social-post[data-id]')]
      .filter(card => !card.dataset.presenceBound);

    const ids = cards.map(card => card.dataset.id).filter(Boolean);
    const missing = ids.filter(id => !postUsers.has(id));

    if (missing.length) {
      const { data } = await supabase
        .from('social_posts')
        .select('id,user_id')
        .in('id',missing);
      (data || []).forEach(row => postUsers.set(String(row.id),row.user_id));
    }

    cards.forEach(card => {
      const userId = postUsers.get(String(card.dataset.id));
      const header = card.querySelector('header > div');
      if (!userId || !header) return;
      card.dataset.presenceBound = '1';
      const dot = document.createElement('span');
      dot.className = 'arc-presence-dot social-presence-dot';
      dot.dataset.presenceUser = userId;
      header.querySelector('strong')?.appendChild(dot);
    });
    dispatch();
  }

  const scheduleSocial = () => {
    clearTimeout(socialTimer);
    socialTimer = setTimeout(() => bindSocialPosts().catch(()=>{}),180);
  };

  await connect();
  await touch();
  touchTimer = setInterval(touch,45_000);

  document.addEventListener('visibilitychange',async () => {
    if (document.visibilityState === 'visible') {
      await touch();
      if (visible && channel) {
        await channel.track({
          user_id:user.id,
          online_at:new Date().toISOString(),
          page:location.pathname
        });
      }
    } else {
      touch();
    }
  });

  window.addEventListener('pagehide',() => { touch(); },{ once:true });

  const observer = new MutationObserver(() => {
    dispatch();
    scheduleSocial();
  });
  observer.observe(document.body,{ childList:true,subtree:true });

  scheduleSocial();
  dispatch();

  const controller = {
    userId:user.id,
    get visible(){ return visible; },
    get online(){ return new Set(online); },
    setVisibility,
    snapshot,
    fmtLastSeen,
    destroy:async () => {
      clearInterval(touchTimer);
      observer.disconnect();
      if (channel) await supabase.removeChannel(channel);
    }
  };

  window.ArcadiaPresence = controller;
  window.dispatchEvent(new CustomEvent('arcadia:presence-ready',{ detail:controller }));
  return controller;
}

export function getPresenceController() {
  controllerPromise ||= initPresence();
  return controllerPromise;
}

getPresenceController();
