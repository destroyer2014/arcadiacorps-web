(function(){
  function waitForApi(){ return new Promise(resolve => { const tick=()=>window.ArcadiaSupport?resolve(window.ArcadiaSupport):setTimeout(tick,80); tick(); }); }
  let api, profile, tickets=[], activeFilter='all', activeTicket=null;

  async function init(){
    api=await waitForApi();
    if(!api.requireLogin()) return;
    try{ profile=await api.getProfile(); }catch(e){}
    if(!profile) return;
    document.querySelector('[data-auth-message]')?.remove();
    document.getElementById('ticketDashboard').hidden=false;
    bind(); await loadTickets();
    const q=new URLSearchParams(location.search).get('ticket'); if(q) openTicket(Number(q));
  }
  function bind(){
    const modal=document.getElementById('newTicketModal');
    const open=()=>{modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';};
    const close=()=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.style.overflow='';};
    document.getElementById('newTicketBtn').onclick=open;
    document.getElementById('closeTicketModal').onclick=close;
    modal.addEventListener('click',e=>{if(e.target===modal)close();});
    document.getElementById('refreshTickets').onclick=loadTickets;
    document.querySelectorAll('[data-user-ticket-filter]').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('[data-user-ticket-filter]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');activeFilter=btn.dataset.userTicketFilter;renderTickets();});
    document.getElementById('newTicketForm').addEventListener('submit',async e=>{
      e.preventDefault(); const status=document.getElementById('newTicketStatus'); status.textContent='Creando ticket...';
      const body={user_id:profile.id,subject:document.getElementById('ticketSubject').value.trim(),description:document.getElementById('ticketDescription').value.trim(),category:document.getElementById('ticketCategory').value,priority:document.getElementById('ticketPriority').value};
      try{ const rows=await api.request('/tickets',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)}); e.target.reset(); status.textContent='✓ Ticket creado correctamente'; await loadTickets(); setTimeout(close,500); if(rows?.[0])openTicket(rows[0].ticket_number); }
      catch(err){status.textContent='✗ '+friendly(err);}
    });
  }
  async function loadTickets(){
    const list=document.getElementById('ticketList'); list.innerHTML='<div class="ticket-loading">Actualizando...</div>';
    try{ tickets=await api.request('/tickets?user_id=eq.'+encodeURIComponent(profile.id)+'&select=ticket_number,ticket_code,subject,category,priority,status,assigned_to,created_at,updated_at,last_message_at&order=last_message_at.desc'); renderTickets(); }
    catch(e){list.innerHTML='<div class="ticket-error">No se pudieron cargar los tickets.</div>';}
  }
  function renderTickets(){
    const visible=tickets.filter(t=>activeFilter==='all'||(activeFilter==='abierto'&&!['resuelto','cerrado'].includes(t.status))||t.status===activeFilter);
    document.getElementById('ticketCount').textContent=`${visible.length} ticket${visible.length===1?'':'s'}`;
    document.getElementById('ticketList').innerHTML=visible.length?visible.map(t=>`<button type="button" class="ticket-list-item ${activeTicket===t.ticket_number?'active':''}" data-ticket-id="${t.ticket_number}"><div><span class="ticket-code">${api.escapeHtml(t.ticket_code)}</span><span class="ticket-status status-${t.status}">${labelStatus(t.status)}</span></div><strong>${api.escapeHtml(t.subject)}</strong><p>${api.escapeHtml(t.category)} · ${api.formatDate(t.last_message_at)}</p></button>`).join(''):'<div class="ticket-empty-list">No hay tickets en este filtro.</div>';
    document.querySelectorAll('[data-ticket-id]').forEach(x=>x.onclick=()=>openTicket(Number(x.dataset.ticketId)));
  }
  async function openTicket(id){
    activeTicket=id; renderTickets(); const panel=document.getElementById('ticketConversation'); panel.innerHTML='<div class="ticket-loading">Cargando conversación...</div>';
    try{
      const ticket=(await api.request('/tickets?ticket_number=eq.'+id+'&select=*'))?.[0]; if(!ticket)throw new Error('NOT_FOUND');
      const messages=await api.request('/ticket_messages?ticket_number=eq.'+id+'&is_internal=eq.false&select=id,sender_id,message,created_at&order=created_at.asc');
      panel.innerHTML=`<header class="conversation-head"><div><span>${api.escapeHtml(ticket.ticket_code)}</span><h2>${api.escapeHtml(ticket.subject)}</h2><p>${api.escapeHtml(ticket.category)} · Prioridad ${api.escapeHtml(ticket.priority)}</p></div><span class="ticket-status status-${ticket.status}">${labelStatus(ticket.status)}</span></header><div class="conversation-messages" id="conversationMessages">${renderMessages(messages)}</div>${ticket.status==='cerrado'?'<div class="conversation-closed">Este ticket está cerrado.</div>':`<form class="ticket-reply-form" id="userReplyForm"><textarea id="userReplyMessage" rows="3" required maxlength="10000" placeholder="Escribe una respuesta..."></textarea><button class="ticket-primary-btn" type="submit">Enviar respuesta</button><div class="ticket-form-status" id="userReplyStatus"></div></form>`}`;
      panel.querySelector('#userReplyForm')?.addEventListener('submit',async e=>{e.preventDefault(); const text=document.getElementById('userReplyMessage').value.trim(); if(!text)return; const s=document.getElementById('userReplyStatus');s.textContent='Enviando...';try{await api.request('/ticket_messages',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({ticket_number:id,sender_id:profile.id,message:text,is_internal:false})});document.getElementById('userReplyMessage').value='';await openTicket(id);await loadTickets();}catch(err){s.textContent='✗ '+friendly(err);}});
      setTimeout(()=>{const box=document.getElementById('conversationMessages');if(box)box.scrollTop=box.scrollHeight;},30);
    }catch(e){panel.innerHTML='<div class="ticket-error">No se pudo abrir este ticket.</div>';}
  }
  function renderMessages(messages){return messages?.length?messages.map(m=>`<article class="ticket-message ${m.sender_id===profile.id?'from-user':'from-staff'}"><div>${m.sender_id===profile.id?'Tú':'Equipo de soporte'}</div><p>${api.escapeHtml(m.message).replace(/\n/g,'<br>')}</p><time>${api.formatDate(m.created_at)}</time></article>`).join(''):'<div class="ticket-empty-list">Aún no hay mensajes.</div>';}
  function labelStatus(s){return({abierto:'Abierto',en_proceso:'En proceso',esperando_usuario:'Esperando respuesta',resuelto:'Resuelto',cerrado:'Cerrado'})[s]||s;}
  function friendly(e){return e.message==='AUTH_REQUIRED'?'Debes iniciar sesión.':e.message||'Error inesperado';}
  document.addEventListener('DOMContentLoaded',init);
})();
