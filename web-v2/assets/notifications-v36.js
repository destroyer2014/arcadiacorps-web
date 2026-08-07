import { supabase } from './auth.js';

const { data: { session } } = await supabase.auth.getSession();
if (session?.user) {
  const user = session.user;
  let rows = [];
  let channel = null;

  const esc = value => String(value ?? '');

  async function waitHeader() {
    for (let i=0;i<80;i+=1) {
      const host = document.querySelector('#arcadiaHeaderActions');
      if (host) return host;
      await new Promise(resolve => setTimeout(resolve,50));
    }
    return null;
  }

  const host = await waitHeader();
  if (host && !document.querySelector('#arcNotificationCenter')) {
    const center = document.createElement('div');
    center.id = 'arcNotificationCenter';
    center.className = 'arc-notification-center';
    center.innerHTML = `
      <button class="arc-notification-bell" type="button" aria-label="Notificaciones">
        🔔 <span class="arc-notification-count" hidden>0</span>
      </button>
      <section class="arc-notification-popover" aria-hidden="true">
        <header>
          <div><strong>Notificaciones</strong><small>Actividad de tu cuenta</small></div>
          <button class="arc-notification-read" type="button">Marcar leídas</button>
        </header>
        <div class="arc-notification-list"></div>
      </section>`;
    host.appendChild(center);

    const bell = center.querySelector('.arc-notification-bell');
    const count = center.querySelector('.arc-notification-count');
    const popover = center.querySelector('.arc-notification-popover');
    const list = center.querySelector('.arc-notification-list');
    const readAll = center.querySelector('.arc-notification-read');

    function render() {
      const unread = rows.filter(row => !row.read_at).length;
      count.textContent = unread > 99 ? '99+' : String(unread);
      count.hidden = !unread;

      list.replaceChildren();
      if (!rows.length) {
        const empty = document.createElement('div');
        empty.className = 'arc-notification-empty';
        empty.textContent = 'No tienes notificaciones.';
        list.appendChild(empty);
        return;
      }

      rows.forEach(row => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `arc-notification-item ${row.read_at ? '' : 'unread'}`;
        const title = document.createElement('strong');
        title.textContent = esc(row.title);
        const body = document.createElement('span');
        body.textContent = esc(row.body);
        const time = document.createElement('small');
        time.textContent = new Date(row.created_at).toLocaleString('es-PE');
        button.append(title,body,time);
        button.addEventListener('click',async () => {
          if (!row.read_at) {
            const now = new Date().toISOString();
            await supabase.from('arc_notifications')
              .update({ read_at:now })
              .eq('id',row.id)
              .eq('user_id',user.id);
            row.read_at = now;
            render();
          }
          if (row.link) location.href = row.link;
        });
        list.appendChild(button);
      });
    }

    async function load() {
      const { data,error } = await supabase
        .from('arc_notifications')
        .select('id,type,title,body,link,read_at,created_at')
        .eq('user_id',user.id)
        .order('created_at',{ ascending:false })
        .limit(30);
      if (!error) {
        rows = data || [];
        render();
      }
    }

    bell.addEventListener('click',event => {
      event.stopPropagation();
      const open = popover.classList.toggle('open');
      popover.setAttribute('aria-hidden',String(!open));
    });

    document.addEventListener('click',event => {
      if (!center.contains(event.target)) {
        popover.classList.remove('open');
        popover.setAttribute('aria-hidden','true');
      }
    });

    readAll.addEventListener('click',async () => {
      const ids = rows.filter(row => !row.read_at).map(row => row.id);
      if (!ids.length) return;
      const now = new Date().toISOString();
      const { error } = await supabase.from('arc_notifications')
        .update({ read_at:now })
        .in('id',ids)
        .eq('user_id',user.id);
      if (!error) {
        rows.forEach(row => { if (ids.includes(row.id)) row.read_at = now; });
        render();
      }
    });

    await load();

    channel = supabase.channel(`arc-notifications-${user.id}`)
      .on('postgres_changes',{
        event:'INSERT',
        schema:'public',
        table:'arc_notifications',
        filter:`user_id=eq.${user.id}`
      },payload => {
        rows.unshift(payload.new);
        rows = rows.slice(0,30);
        render();
      })
      .subscribe();

    window.addEventListener('pagehide',() => {
      if (channel) supabase.removeChannel(channel);
    },{ once:true });
  }
}
