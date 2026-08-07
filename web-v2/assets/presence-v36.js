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
  const { data:{ session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const user = session.user;
  let visible = true;
  let online = new Set();
  let channel = null;
  let touchTimer = null;
  let socialTimer = null;
  let socialObserver = null;
  let shellObserver = null;
  let framePending = false;
  let lastSignature = '';
  const postUsers = new Map();

  try {
    const { data } = await supabase.rpc('arc_presence_snapshot',{
      target_ids:[user.id]
    });
    const own = Array.isArray(data) ? data[0] : null;
    if (own) visible = own.presence_visible !== false;
  } catch {}

  function renderNodes(root=document) {
    root.querySelectorAll?.('[data-presence-user]').forEach(node => {
      const id = node.dataset.presenceUser;
      const isOnline = online.has(id);
      if (node.dataset.presenceState === String(isOnline)) return;
      node.dataset.presenceState = String(isOnline);
      node.classList.toggle('online',isOnline);
      node.classList.toggle('offline',!isOnline);
      node.title = isOnline ? 'En línea' : 'Desconectado';
    });

    const sidebarText = document.querySelector('#sidebarPresenceText');
    if (sidebarText) {
      const next = visible
        ? (online.has(user.id) ? 'En línea' : 'Conectando…')
        : 'Estado oculto';
      if (sidebarText.textContent !== next) sidebarText.textContent = next;
    }
  }

  function dispatch(force=false) {
    if (framePending && !force) return;
    framePending = true;

    requestAnimationFrame(() => {
      framePending = false;
      renderNodes();

      const signature = `${visible}|${[...online].sort().join(',')}`;
      if (signature === lastSignature && !force) return;
      lastSignature = signature;

      window.dispatchEvent(new CustomEvent('arcadia:presence',{
        detail:{ online:new Set(online),visible,userId:user.id }
      }));
    });
  }

  async function touch() {
    try { await supabase.rpc('arc_touch_presence'); } catch {}
  }

  async function connect() {
    channel = supabase.channel('arc-chat-presence',{
      config:{ presence:{ key:user.id } }
    });

    channel
      .on('presence',{ event:'sync' },() => {
        online = new Set(Object.keys(channel.presenceState()));
        dispatch(true);
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED' && visible) {
          await channel.track({
            user_id:user.id,
            online_at:new Date().toISOString(),
            page:location.pathname
          });
        }
      });
  }

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

    dispatch(true);
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
    if (!cards.length) return;

    const ids = cards.map(card=>card.dataset.id).filter(Boolean);
    const missing = ids.filter(id=>!postUsers.has(id));

    if (missing.length) {
      const { data } = await supabase
        .from('social_posts')
        .select('id,user_id')
        .in('id',missing);
      (data || []).forEach(row=>postUsers.set(String(row.id),row.user_id));
    }

    cards.forEach(card => {
      const userId = postUsers.get(String(card.dataset.id));
      const strong = card.querySelector('header > div strong');
      if (!userId || !strong) return;

      card.dataset.presenceBound = '1';
      const dot = document.createElement('span');
      dot.className = 'arc-presence-dot social-presence-dot';
      dot.dataset.presenceUser = userId;
      strong.appendChild(dot);
      renderNodes(card);
    });
  }

  function scheduleSocial() {
    if (!location.pathname.endsWith('/social.html')) return;
    clearTimeout(socialTimer);
    socialTimer = setTimeout(() => {
      bindSocialPosts().catch(()=>{});
    },250);
  }

  function watchShellOnce() {
    if (document.querySelector('#arcadiaShell')) {
      renderNodes();
      return;
    }

    shellObserver = new MutationObserver((_records,observer) => {
      const shell = document.querySelector('#arcadiaShell');
      if (!shell) return;
      observer.disconnect();
      shellObserver = null;
      renderNodes(shell);
      dispatch(true);
    });

    shellObserver.observe(document.body,{ childList:true });
    setTimeout(() => {
      shellObserver?.disconnect();
      shellObserver = null;
    },4000);
  }

  function watchSocialOnly() {
    if (!location.pathname.endsWith('/social.html')) return;
    const feed = document.querySelector('#feed');
    if (!feed) {
      setTimeout(watchSocialOnly,400);
      return;
    }

    socialObserver = new MutationObserver(scheduleSocial);
    socialObserver.observe(feed,{ childList:true });
    scheduleSocial();
  }

  await connect();
  await touch();

  touchTimer = setInterval(() => {
    if (document.visibilityState === 'visible') touch();
  },60_000);

  document.addEventListener('visibilitychange',async () => {
    if (document.visibilityState !== 'visible') return;
    await touch();
    if (visible && channel) {
      await channel.track({
        user_id:user.id,
        online_at:new Date().toISOString(),
        page:location.pathname
      });
    }
  });

  watchShellOnce();
  watchSocialOnly();
  dispatch(true);

  const controller = {
    userId:user.id,
    get visible(){ return visible; },
    get online(){ return new Set(online); },
    setVisibility,
    snapshot,
    fmtLastSeen,
    render:renderNodes,
    destroy:async () => {
      clearInterval(touchTimer);
      clearTimeout(socialTimer);
      shellObserver?.disconnect();
      socialObserver?.disconnect();
      if (channel) await supabase.removeChannel(channel);
    }
  };

  window.ArcadiaPresence = controller;
  window.dispatchEvent(new CustomEvent('arcadia:presence-ready',{
    detail:controller
  }));
  return controller;
}

export function getPresenceController() {
  controllerPromise ||= initPresence();
  return controllerPromise;
}

getPresenceController();
