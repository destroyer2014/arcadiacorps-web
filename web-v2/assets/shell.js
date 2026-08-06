import { supabase } from './auth.js';
import { APP_URL } from './config.js';
import { getCurrentAccess, ROLE_LABELS } from './access.js';
const escapeHtml=(value='')=>String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const active=(...paths)=>paths.some(path=>window.location.pathname.endsWith(path))?' active':'';
const link=(paths,href,icon,label)=>`<a class="${active(...paths)}" href="${APP_URL}/${href}"><span class="sidebar-section-icon">${icon}</span><span>${label}</span></a>`;
export async function mountShell(){
 const access=await getCurrentAccess();if(!access)return null;
 const{profile,user,role}=access,displayName=profile.full_name||profile.username||user.email?.split('@')[0]||'Usuario',avatarUrl=profile.avatar_url||user.user_metadata?.avatar_url||user.user_metadata?.picture||'',initial=displayName[0].toUpperCase();
 if(!document.querySelector('link[href*="theme-v32.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='assets/theme-v32.css?v=32';document.head.appendChild(l)}
 document.body.classList.add('with-app-shell');
 const root=document.createElement('div');root.id='arcadiaShell';root.innerHTML=`
 <header class="app-header"><button class="menu-toggle" id="menuToggle" type="button" aria-label="Abrir menú">☰</button><a class="app-brand" href="${APP_URL}/dashboard.html"><span class="mini-logo">A</span><span>Arcadia<span>Corps</span></span></a><div class="header-user"><span class="presence-dot"></span><span>${escapeHtml(displayName)}</span></div></header>
 <div class="sidebar-backdrop" id="sidebarBackdrop"></div>
 <aside class="app-sidebar" id="appSidebar"><div class="sidebar-profile">${avatarUrl?`<img src="${escapeHtml(avatarUrl)}" class="sidebar-avatar" alt="">`:`<div class="sidebar-avatar fallback">${initial}</div>`}<div><strong>${escapeHtml(displayName)}</strong><small>${escapeHtml(user.email||'')}</small><span class="role-pill role-${escapeHtml(role)}">${escapeHtml(ROLE_LABELS[role]||role)}</span></div></div>
 <nav class="sidebar-nav">
  <details open><summary>Portal <span>⌄</span></summary>${link(['dashboard.html'],'dashboard.html','⌂','Inicio')}${link(['profile.html'],'profile.html','◉','Mi perfil')}${link(['news.html','news-detail.html','news-editor.html'],'news.html','▤','Noticias')}</details>
  <details open><summary>Social <span>⌄</span></summary>${link(['social.html'],'social.html','◎','Comunidad')}${link(['chat.html'],'chat.html','✉','Chat privado')}</details>
  <details><summary>Arcadia Shop <span>⌄</span></summary>${link(['store.html'],'store.html','🛍','Tienda')}${link(['purchases.html'],'purchases.html','🧾','Mis compras')}</details>
  <details><summary>Servicios <span>⌄</span></summary>${link(['subbots.html'],'subbots.html','🤖','Mis Sub-Bots')}${link(['tickets.html','ticket-new.html','ticket-detail.html'],'tickets.html','🎫','Mis tickets')}</details>
  ${['owner','staff'].includes(role)?`<details><summary>Soporte <span>⌄</span></summary>${link(['support-tickets.html'],'support-tickets.html','🛡','Atender tickets')}</details>`:''}
  ${role==='owner'?`<details><summary>Administración <span>⌄</span></summary>${link(['admin-users.html'],'admin-users.html','♛','Usuarios y roles')}${link(['store-admin.html'],'store-admin.html','⚙','Administrar tienda')}</details>`:''}
 </nav><div class="sidebar-footer"><button id="shellLogout" class="sidebar-logout" type="button">Cerrar sesión</button><small>ArcadiaCorps · RPG Neon v32</small></div></aside>`;
 document.body.prepend(root);const close=()=>document.body.classList.remove('sidebar-open');root.querySelector('#menuToggle').onclick=()=>document.body.classList.toggle('sidebar-open');root.querySelector('#sidebarBackdrop').onclick=close;root.querySelectorAll('.sidebar-nav a').forEach(a=>a.onclick=close);root.querySelector('#shellLogout').onclick=async e=>{e.currentTarget.disabled=true;e.currentTarget.textContent='Cerrando…';await supabase.auth.signOut({scope:'local'});location.replace(`${APP_URL}/login.html?logout=1`)};return access;
}
