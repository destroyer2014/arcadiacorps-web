(function(){
  'use strict';

  const URL = 'https://dtfecbsokpgzyuiyxyvm.supabase.co';
  const KEY = 'sb_publishable_SU7zJytoYMgoGtYoobINDQ_qLSO0bw1';
  const REST = URL + '/rest/v1';
  const AUTH = URL + '/auth/v1';

  function getSession(){
    try { return JSON.parse(localStorage.getItem('pragmata_session') || 'null'); }
    catch (_) { return null; }
  }

  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function formatDate(value){
    if(!value) return '';
    return new Intl.DateTimeFormat('es-PE', {dateStyle:'medium', timeStyle:'short'}).format(new Date(value));
  }

  async function request(path, options = {}){
    const session = getSession();
    if(!session?.access_token) throw new Error('AUTH_REQUIRED');
    const headers = {
      apikey: KEY,
      Authorization: 'Bearer ' + session.access_token,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    const response = await fetch(REST + path, {...options, headers});
    if(!response.ok){
      let detail = '';
      try { detail = (await response.json()).message || ''; } catch (_) {}
      throw new Error(detail || `HTTP_${response.status}`);
    }
    if(response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  async function getUser(){
    const session = getSession();
    if(!session?.access_token) return null;
    const response = await fetch(AUTH + '/user', {headers:{apikey:KEY, Authorization:'Bearer ' + session.access_token}});
    if(!response.ok) return null;
    return response.json();
  }

  async function getProfile(){
    const user = await getUser();
    if(!user) return null;
    const rows = await request('/profiles?id=eq.' + encodeURIComponent(user.id) + '&select=id,email,display_name,username,role,is_active');
    return rows?.[0] || null;
  }

  function requireLogin(message = 'Inicia sesión para usar esta sección.'){
    const session = getSession();
    if(session?.access_token) return true;
    document.getElementById('authGate')?.classList.remove('hide');
    document.body.style.overflow = 'hidden';
    const el = document.querySelector('[data-auth-message]');
    if(el) el.textContent = message;
    return false;
  }

  window.ArcadiaSupport = {URL, KEY, REST, AUTH, getSession, request, getUser, getProfile, requireLogin, escapeHtml, formatDate};

  async function initHeaderNotifications(){
    const panel = document.getElementById('notifPanel');
    const badge = document.getElementById('notifBadge');
    if(!panel || !badge || !getSession()?.access_token) return;

    panel.innerHTML = '<div class="notif-head">Notificaciones</div><div class="notif-loading">Cargando...</div>';

    let profile;
    try { profile = await getProfile(); } catch (_) { return; }
    if(!profile) return;

    async function load(){
      try{
        const notifications = await request('/notifications?select=id,title,message,notification_type,action_label,action_url,created_at&is_active=eq.true&order=created_at.desc&limit=20');
        const reads = await request('/notification_reads?user_id=eq.' + encodeURIComponent(profile.id) + '&select=notification_id,read_at,dismissed_at');
        const readMap = new Map((reads || []).map(r => [String(r.notification_id), r]));
        const visible = (notifications || []).filter(n => !readMap.get(String(n.id))?.dismissed_at);
        const unread = visible.filter(n => !readMap.has(String(n.id))).length;
        badge.textContent = unread > 99 ? '99+' : String(unread);
        badge.classList.toggle('hide', unread === 0);

        panel.innerHTML = '<div class="notif-head"><span>Notificaciones</span><a href="panel.html#notifications">Ver todas</a></div>' +
          (visible.length ? visible.slice(0,8).map(n => `
            <article class="notif-card dynamic-notif ${readMap.has(String(n.id)) ? 'is-read' : ''}" data-notification-id="${n.id}">
              <div class="notif-icon">${n.notification_type === 'ticket_reply' ? '🎫' : n.notification_type === 'new_ticket' ? '🎧' : '🔔'}</div>
              <div class="notif-body">
                <b>${escapeHtml(n.title)}</b>
                <p>${escapeHtml(n.message)}</p>
                <div class="notif-actions-row">
                  ${n.action_url ? `<a href="${escapeHtml(n.action_url)}">${escapeHtml(n.action_label || 'Abrir')}</a>` : ''}
                  <button type="button" data-dismiss-notification="${n.id}">Ocultar</button>
                </div>
                <span class="notif-date">${formatDate(n.created_at)}</span>
              </div>
            </article>`).join('') : '<div class="notif-empty">No tienes notificaciones pendientes.</div>');

        panel.querySelectorAll('.dynamic-notif').forEach(card => {
          card.addEventListener('click', async e => {
            if(e.target.closest('a,button')) return;
            const id = card.dataset.notificationId;
            await markRead(id, false);
            card.classList.add('is-read');
          });
        });
        panel.querySelectorAll('[data-dismiss-notification]').forEach(btn => {
          btn.addEventListener('click', async e => {
            e.stopPropagation();
            await markRead(btn.dataset.dismissNotification, true);
            btn.closest('.dynamic-notif')?.remove();
          });
        });

        showFloating(visible.filter(n => !readMap.has(String(n.id))).slice(0,2));
      }catch(err){
        panel.innerHTML = '<div class="notif-head">Notificaciones</div><div class="notif-empty">No se pudieron cargar.</div>';
      }
    }

    async function markRead(notificationId, dismiss){
      const body = {notification_id:Number(notificationId), user_id:profile.id, read_at:new Date().toISOString(), dismissed_at:dismiss ? new Date().toISOString() : null};
      await request('/notification_reads?on_conflict=notification_id,user_id', {
        method:'POST',
        headers:{Prefer:'resolution=merge-duplicates,return=minimal'},
        body:JSON.stringify(body)
      });
    }

    function showFloating(items){
      if(!items.length || document.querySelector('.floating-notification-stack')) return;
      const stack = document.createElement('div');
      stack.className = 'floating-notification-stack';
      stack.innerHTML = items.map((n,i) => `
        <article class="floating-notification" style="--float-index:${i}" data-float-id="${n.id}">
          <button type="button" class="floating-notif-close" aria-label="Cerrar">×</button>
          <span class="floating-notif-kicker">${n.notification_type === 'ticket_reply' ? 'Soporte' : 'Aviso'}</span>
          <h3>${escapeHtml(n.title)}</h3>
          <p>${escapeHtml(n.message)}</p>
          <div class="floating-notif-bottom">
            ${n.action_url ? `<a href="${escapeHtml(n.action_url)}">${escapeHtml(n.action_label || 'Abrir')}</a>` : '<span></span>'}
            <time>${formatDate(n.created_at)}</time>
          </div>
        </article>`).join('');
      document.body.appendChild(stack);
      stack.querySelectorAll('.floating-notification').forEach(card => {
        card.querySelector('.floating-notif-close').addEventListener('click', async () => {
          await markRead(card.dataset.floatId, true);
          card.classList.add('leaving');
          setTimeout(() => card.remove(), 250);
        });
      });
    }

    await load();
    setInterval(load, 45000);

    if(profile.role === 'staff' || profile.role === 'owner'){
      document.querySelectorAll('[data-staff-only]').forEach(el => el.hidden = false);
    }
    if(profile.role === 'owner'){
      document.querySelectorAll('[data-owner-only]').forEach(el => el.hidden = false);
    }
  }

  if(document.getElementById('notifPanel')) setTimeout(initHeaderNotifications, 500);
  else document.addEventListener('partialsReady', () => setTimeout(initHeaderNotifications, 500), {once:true});
})();
