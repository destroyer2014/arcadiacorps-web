(function(){
  'use strict';
  let api, profile, users=[], tickets=[], authUsers=[], pendingAction=null;
  const FN='/functions/v1/owner-account-admin';

  async function waitForApi(){for(let i=0;i<60;i++){if(window.ArcadiaSupport)return window.ArcadiaSupport;await new Promise(r=>setTimeout(r,100));}throw new Error('No se cargó el sistema de soporte.');}
  const $=id=>document.getElementById(id);
  const esc=v=>api.escapeHtml(v);
  function setStatus(text,type=''){const el=$('ownerAccountStatus');if(el){el.textContent=text;el.dataset.type=type;}}

  async function invoke(action,payload={}){
    const session=api.getSession();
    if(!session?.access_token) throw new Error('Tu sesión venció. Vuelve a iniciar sesión.');
    const res=await fetch(api.URL+FN,{method:'POST',headers:{apikey:api.KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});
    let data={};try{data=await res.json();}catch(_){}
    if(!res.ok) throw new Error(data.error||data.message||'No se pudo completar la acción.');
    return data;
  }

  async function init(){
    api=await waitForApi(); if(!api.requireLogin())return;
    profile=await api.getProfile(); const msg=$('ownerAccessMessage');
    if(!profile||profile.role!=='owner'||profile.is_active===false){msg.textContent='Solo un owner activo puede acceder a este panel.';return;}
    msg.remove(); $('ownerDashboard').hidden=false; bind(); await loadAll();
  }

  function bind(){
    document.querySelectorAll('[data-owner-tab]').forEach(btn=>btn.onclick=()=>switchTab(btn.dataset.ownerTab));
    $('ownerRefreshUsers').onclick=loadProfiles; $('ownerRefreshAccounts').onclick=loadAccounts; $('ownerRefreshAudit').onclick=loadAudit;
    $('ownerUserSearch').oninput=renderUsers; $('ownerAccountSearch').oninput=renderAccounts;
    $('ownerNotifScope').onchange=toggleTargets; $('ownerNotificationForm').onsubmit=publish;
    $('ownerActionForm').addEventListener('submit',submitAction);
    $('ownerActionClose').onclick=closeAction;
    $('ownerActionCancel').onclick=closeAction;
  }

  function switchTab(name){
    document.querySelectorAll('[data-owner-tab]').forEach(b=>b.classList.toggle('active',b.dataset.ownerTab===name));
    document.querySelectorAll('[data-owner-panel]').forEach(p=>{const active=p.dataset.ownerPanel===name;p.hidden=!active;p.classList.toggle('active',active);});
    if(name==='audit') loadAudit();
  }

  async function loadAll(){await Promise.all([loadProfiles(),loadAccounts()]);}
  async function loadProfiles(){
    try{[users,tickets]=await Promise.all([api.request('/profiles?select=id,email,display_name,username,role,is_active,created_at&order=created_at.desc'),api.request('/tickets?select=ticket_number,status,created_at')]);renderUsers();summary();fillUsers();}
    catch(e){$('ownerUserList').innerHTML='<div class="ticket-error">No se pudieron cargar perfiles.</div>';}
  }
  async function loadAccounts(){
    setStatus('Consultando cuentas…'); $('ownerAccountList').innerHTML='<div class="ticket-loading">Cargando cuentas...</div>';
    try{const data=await invoke('list_users');authUsers=data.users||[];renderAccounts();setStatus(`${authUsers.length} cuentas cargadas.`,'ok');}
    catch(e){$('ownerAccountList').innerHTML='<div class="ticket-error">No se pudieron cargar las cuentas.</div>';setStatus(e.message,'error');}
  }
  function summary(){const open=tickets.filter(t=>!['resuelto','cerrado'].includes(t.status)).length;$('ownerSummary').innerHTML=`<article><span>Usuarios</span><strong>${users.length}</strong></article><article><span>Staff</span><strong>${users.filter(u=>u.role==='staff').length}</strong></article><article><span>Tickets abiertos</span><strong>${open}</strong></article><article><span>Owners</span><strong>${users.filter(u=>u.role==='owner').length}</strong></article>`;}

  function renderAccounts(){
    const q=$('ownerAccountSearch').value.trim().toLowerCase();
    const rows=authUsers.filter(u=>`${u.email||''} ${u.display_name||''} ${u.username||''} ${u.id}`.toLowerCase().includes(q));
    $('ownerAccountList').innerHTML=rows.length?rows.map(u=>{
      const self=u.id===profile.id; const confirmed=!!u.email_confirmed_at; const banned=!!u.banned_until&&new Date(u.banned_until)>new Date();
      return `<article class="owner-account-row"><div class="owner-account-main"><strong>${esc(u.display_name||u.username||u.email||'Sin nombre')}</strong><span>${esc(u.email||'Sin correo')}</span><div class="owner-account-meta"><b>${esc(u.role||'user')}</b><b>${confirmed?'Correo confirmado':'Sin confirmar'}</b>${banned?'<b class="is-banned">Suspendida</b>':''}<b>Último acceso: ${u.last_sign_in_at?api.formatDate(u.last_sign_in_at):'Nunca'}</b></div></div><div class="owner-account-actions"><button data-account-action="recovery" data-user="${u.id}">Recuperación</button><button data-account-action="confirm_email" data-user="${u.id}" ${confirmed?'disabled':''}>Confirmar email</button><button data-account-action="change_email" data-user="${u.id}">Cambiar email</button><button data-account-action="temp_password" data-user="${u.id}" ${self?'disabled':''}>Clave temporal</button><button class="danger" data-account-action="${banned?'unban':'ban'}" data-user="${u.id}" ${self?'disabled':''}>${banned?'Reactivar':'Suspender'}</button></div></article>`;
    }).join(''):'<div class="owner-audit-empty">No se encontraron cuentas.</div>';
    document.querySelectorAll('[data-account-action]').forEach(b=>b.onclick=()=>openAction(b.dataset.accountAction,authUsers.find(u=>u.id===b.dataset.user)));
  }

  const actionDefs={
    recovery:{title:'Enviar recuperación',description:u=>`Supabase enviará un correo de recuperación a ${u.email}.`,fields:()=>''},
    confirm_email:{title:'Confirmar correo',description:u=>`Se marcará ${u.email} como correo confirmado.`,fields:()=>''},
    change_email:{title:'Cambiar correo',description:u=>`El correo de ${u.email} se cambiará inmediatamente.`,fields:u=>`<label>Nuevo correo<input id="ownerNewEmail" type="email" required value="${esc(u.email||'')}"></label>`},
    temp_password:{title:'Asignar clave temporal',description:u=>`Se reemplazará la contraseña de ${u.email}. Comunícala por un canal seguro.`,fields:()=>'<label>Contraseña temporal<input id="ownerTempPassword" type="password" required minlength="10" autocomplete="new-password" placeholder="Mínimo 10 caracteres"></label><label class="staff-mine-toggle"><input id="ownerConfirmTempPassword" type="checkbox" required> Confirmo que la entregaré de forma segura</label>'},
    ban:{title:'Suspender cuenta',description:u=>`La cuenta ${u.email} no podrá iniciar sesión hasta ser reactivada.`,fields:()=>''},
    unban:{title:'Reactivar cuenta',description:u=>`La cuenta ${u.email} recuperará el acceso.`,fields:()=>''}
  };
  function closeAction(){
    pendingAction=null;
    $('ownerActionStatus').textContent='';
    $('ownerActionDialog').close();
  }

  function openAction(action,user){
    const def=actionDefs[action]; if(!def||!user)return; pendingAction={action,user};
    $('ownerActionTitle').textContent=def.title; $('ownerActionDescription').textContent=def.description(user); $('ownerActionFields').innerHTML=def.fields(user); $('ownerActionReason').value=''; $('ownerActionStatus').textContent=''; $('ownerActionDialog').showModal();
  }
  async function submitAction(e){
    e.preventDefault(); if(!pendingAction)return;
    const reason=$('ownerActionReason').value.trim(); if(reason.length<5){$('ownerActionStatus').textContent='Escribe un motivo de al menos 5 caracteres.';return;}
    const payload={user_id:pendingAction.user.id,reason};
    if(pendingAction.action==='change_email')payload.email=$('ownerNewEmail').value.trim();
    if(pendingAction.action==='temp_password')payload.password=$('ownerTempPassword').value;
    $('ownerActionConfirm').disabled=true; $('ownerActionStatus').textContent='Procesando…';
    try{await invoke(pendingAction.action,payload);$('ownerActionStatus').textContent='✓ Acción completada';setTimeout(()=>$('ownerActionDialog').close(),650);await Promise.all([loadAccounts(),loadProfiles()]);}
    catch(err){$('ownerActionStatus').textContent='✗ '+err.message;}
    finally{$('ownerActionConfirm').disabled=false;}
  }

  function renderUsers(){const q=$('ownerUserSearch').value.toLowerCase();const rows=users.filter(u=>(`${u.email||''} ${u.display_name||''} ${u.username||''}`).toLowerCase().includes(q));$('ownerUserList').innerHTML=rows.map(u=>`<article class="owner-user-row"><div><strong>${esc(u.display_name||u.username||u.email)}</strong><span>${esc(u.email)}</span></div><div><select data-role-user="${u.id}" ${u.id===profile.id?'disabled':''}><option value="user" ${u.role==='user'?'selected':''}>Usuario</option><option value="staff" ${u.role==='staff'?'selected':''}>Staff</option><option value="owner" ${u.role==='owner'?'selected':''}>Owner</option></select><button type="button" data-active-user="${u.id}" ${u.id===profile.id?'disabled':''}>${u.is_active?'Desactivar':'Activar'}</button></div></article>`).join('');document.querySelectorAll('[data-role-user]').forEach(s=>s.onchange=()=>patchUser(s.dataset.roleUser,{role:s.value},'change_role'));document.querySelectorAll('[data-active-user]').forEach(b=>b.onclick=()=>{const u=users.find(x=>x.id===b.dataset.activeUser);patchUser(u.id,{is_active:!u.is_active},u.is_active?'deactivate_profile':'activate_profile');});}
  async function patchUser(id,patch,action){const reason=prompt('Motivo de este cambio:');if(!reason||reason.trim().length<5){await loadProfiles();return;}try{await api.request('/profiles?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(patch)});await api.request('/admin_audit_logs',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({actor_id:profile.id,target_user_id:id,action,reason:reason.trim(),metadata:patch})});await loadProfiles();}catch(e){alert('No se pudo actualizar: '+e.message);await loadProfiles();}}
  function toggleTargets(){const s=$('ownerNotifScope').value;$('ownerRoleTargetWrap').hidden=s!=='role';$('ownerUserTargetWrap').hidden=s!=='user';}
  function fillUsers(){$('ownerNotifUser').innerHTML=users.map(u=>`<option value="${u.id}">${esc(u.email)}</option>`).join('');}
  async function publish(e){e.preventDefault();const scope=$('ownerNotifScope').value;const body={title:$('ownerNotifTitle').value.trim(),message:$('ownerNotifMessage').value.trim(),notification_type:'announcement',scope,created_by:profile.id,action_label:$('ownerNotifActionLabel').value.trim()||null,action_url:$('ownerNotifActionUrl').value.trim()||null,is_active:true,target_role:scope==='role'?$('ownerNotifRole').value:null,target_user_id:scope==='user'?$('ownerNotifUser').value:null};const status=$('ownerNotifStatus');status.textContent='Publicando...';try{await api.request('/notifications',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(body)});status.textContent='✓ Notificación publicada';e.target.reset();toggleTargets();}catch(err){status.textContent='✗ '+err.message;}}
  async function loadAudit(){const el=$('ownerAuditList');el.innerHTML='<div class="ticket-loading">Cargando actividad...</div>';try{const rows=await api.request('/admin_audit_logs?select=id,actor_id,target_user_id,action,reason,metadata,created_at&order=created_at.desc&limit=100');el.innerHTML=rows?.length?rows.map(r=>`<article class="owner-audit-row"><strong>${esc(r.action)}</strong><p>${esc(r.reason||'Sin motivo')}</p><small>${api.formatDate(r.created_at)} · destino ${esc(r.target_user_id||'general')}</small></article>`).join(''):'<div class="owner-audit-empty">Todavía no hay acciones registradas.</div>';}catch(e){el.innerHTML='<div class="ticket-error">No se pudo cargar la auditoría.</div>';}}
  init().catch(e=>{console.error(e);const m=$('ownerAccessMessage');if(m)m.textContent='No se pudo iniciar el panel Owner.';});
})();
