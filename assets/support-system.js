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
    try{return new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}
    catch(_){return '';}
  }

  async function request(path, options = {}){
    const session = getSession();
    if(!session?.access_token) throw new Error('AUTH_REQUIRED');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try{
      const headers = {
        apikey: KEY,
        Authorization: 'Bearer ' + session.access_token,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      };
      const response = await fetch(REST + path, {...options, headers, signal:controller.signal});
      if(!response.ok){
        let detail = '';
        try { const data = await response.json(); detail = data.message || data.details || ''; } catch (_) {}
        throw new Error(detail || `HTTP_${response.status}`);
      }
      if(response.status === 204) return null;
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    } finally { clearTimeout(timer); }
  }

  async function getUser(){
    const session = getSession();
    if(!session?.access_token) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try{
      const response = await fetch(AUTH + '/user', {signal:controller.signal, headers:{apikey:KEY,Authorization:'Bearer '+session.access_token}});
      if(!response.ok) return null;
      return response.json();
    } catch(_){ return null; }
    finally{ clearTimeout(timer); }
  }

  async function getProfile(){
    const user = await getUser();
    if(!user) return null;
    const rows = await request('/profiles?id=eq.' + encodeURIComponent(user.id) + '&select=id,email,display_name,username,role,is_active');
    return rows?.[0] || {id:user.id,email:user.email,role:'user',is_active:true};
  }

  function requireLogin(message='Inicia sesión para usar esta sección.'){
    const session = getSession();
    if(session?.access_token) return true;
    document.getElementById('authGate')?.classList.remove('hide');
    document.body.style.overflow='hidden';
    const el=document.querySelector('[data-auth-message]');
    if(el) el.textContent=message;
    return false;
  }

  window.ArcadiaSupport={URL,KEY,REST,AUTH,getSession,request,getUser,getProfile,requireLogin,escapeHtml,formatDate};

  async function initHeaderNotifications(){
    const panel=document.getElementById('notifPanel');
    const badge=document.getElementById('notifBadge');
    if(!panel||!badge) return;

    const setPanel=(html)=>{ panel.innerHTML='<div class="notif-head"><span>Notificaciones</span></div>'+html; };
    const session=getSession();
    if(!session?.access_token){
      badge.classList.add('hide');
      setPanel('<div class="notif-empty">Inicia sesión para consultar tus notificaciones.</div>');
      return;
    }

    setPanel('<div class="notif-empty">Consultando notificaciones…</div>');

    let profile=null;
    try{ profile=await getProfile(); }
    catch(err){ console.warn('[notificaciones] perfil:',err); }
    if(!profile?.id){
      badge.classList.add('hide');
      setPanel('<div class="notif-empty">No pudimos validar tu sesión. Vuelve a iniciar sesión.</div>');
      return;
    }

    async function markRead(notificationId,dismiss){
      const body={notification_id:Number(notificationId),user_id:profile.id,read_at:new Date().toISOString(),dismissed_at:dismiss?new Date().toISOString():null};
      return request('/notification_reads?on_conflict=notification_id,user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(body)});
    }

    function showFloating(items){
      document.querySelector('.floating-notification-stack')?.remove();
      if(!items.length) return;
      const stack=document.createElement('div');
      stack.className='floating-notification-stack';
      stack.innerHTML=items.map((n,i)=>`
        <article class="floating-notification" style="--float-index:${i}" data-float-id="${n.id}">
          <button type="button" class="floating-notif-close" aria-label="Cerrar">×</button>
          <span class="floating-notif-kicker">${n.notification_type==='ticket_reply'?'Soporte':'Aviso'}</span>
          <h3>${escapeHtml(n.title)}</h3>
          <p>${escapeHtml(n.message)}</p>
          <div class="floating-notif-bottom">
            ${n.action_url?`<a href="${escapeHtml(n.action_url)}">${escapeHtml(n.action_label||'Abrir')}</a>`:'<span></span>'}
            <time>${formatDate(n.created_at)}</time>
          </div>
        </article>`).join('');
      document.body.appendChild(stack);
      stack.querySelectorAll('.floating-notification').forEach(card=>{
        card.querySelector('.floating-notif-close')?.addEventListener('click',async()=>{
          try{await markRead(card.dataset.floatId,true);}catch(_){}
          card.classList.add('leaving');
          setTimeout(()=>card.remove(),260);
        });
      });
    }

    async function load(){
      try{
        const [notifications,reads]=await Promise.all([
          request('/notifications?select=id,title,message,notification_type,action_label,action_url,created_at&is_active=eq.true&order=created_at.desc&limit=20'),
          request('/notification_reads?user_id=eq.'+encodeURIComponent(profile.id)+'&select=notification_id,read_at,dismissed_at')
        ]);
        const readMap=new Map((reads||[]).map(r=>[String(r.notification_id),r]));
        const visible=(notifications||[]).filter(n=>!readMap.get(String(n.id))?.dismissed_at);
        const unreadItems=visible.filter(n=>!readMap.has(String(n.id)));
        badge.textContent=unreadItems.length>99?'99+':String(unreadItems.length);
        badge.classList.toggle('hide',unreadItems.length===0);

        panel.innerHTML='<div class="notif-head"><span>Notificaciones</span><a href="panel.html#notifications">Ver todas</a></div>'+
          (visible.length?visible.slice(0,8).map(n=>`
            <article class="notif-card dynamic-notif ${readMap.has(String(n.id))?'is-read':''}" data-notification-id="${n.id}">
              <div class="notif-icon">${n.notification_type==='ticket_reply'?'🎫':n.notification_type==='new_ticket'?'🎧':'🔔'}</div>
              <div class="notif-body"><b>${escapeHtml(n.title)}</b><p>${escapeHtml(n.message)}</p>
                <div class="notif-actions-row">${n.action_url?`<a href="${escapeHtml(n.action_url)}">${escapeHtml(n.action_label||'Abrir')}</a>`:''}<button type="button" data-dismiss-notification="${n.id}">Ocultar</button></div>
                <span class="notif-date">${formatDate(n.created_at)}</span>
              </div>
            </article>`).join(''):'<div class="notif-empty">No tienes notificaciones pendientes.</div>');

        panel.querySelectorAll('.dynamic-notif').forEach(card=>card.addEventListener('click',async e=>{
          if(e.target.closest('a,button')) return;
          try{await markRead(card.dataset.notificationId,false);card.classList.add('is-read');}catch(_){}
        }));
        panel.querySelectorAll('[data-dismiss-notification]').forEach(btn=>btn.addEventListener('click',async e=>{
          e.stopPropagation();
          try{await markRead(btn.dataset.dismissNotification,true);}catch(_){}
          btn.closest('.dynamic-notif')?.remove();
        }));
        showFloating(unreadItems.slice(0,2));
      }catch(err){
        console.warn('[notificaciones] carga:',err);
        badge.classList.add('hide');
        setPanel('<div class="notif-empty">No hay avisos disponibles en este momento.</div>');
      }
    }

    await load();
    window.setInterval(load,60000);

    if(profile.role==='staff'||profile.role==='owner') document.querySelectorAll('[data-staff-only]').forEach(el=>el.hidden=false);
    if(profile.role==='owner') document.querySelectorAll('[data-owner-only]').forEach(el=>el.hidden=false);
  }

  const start=()=>setTimeout(initHeaderNotifications,150);
  if(document.getElementById('notifPanel')) start();
  else document.addEventListener('partialsReady',start,{once:true});
})();
