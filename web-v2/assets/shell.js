import { supabase } from './auth.js';
import { APP_URL } from './config.js';
import { getCurrentAccess, ROLE_LABELS } from './access.js';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}

function active(path) {
  return window.location.pathname.endsWith(path) ? ' active' : '';
}

export async function mountShell() {
  const access = await getCurrentAccess();
  if (!access) return null;
  const { profile, user, role } = access;
  const displayName = profile.full_name || profile.username || user.email?.split('@')[0] || 'Usuario';
  const avatarUrl = profile.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || '';
  const initial = displayName.slice(0, 1).toUpperCase();

  document.body.classList.add('with-app-shell');
  const root = document.createElement('div');
  root.id = 'arcadiaShell';
  root.innerHTML = `
    <header class="app-header">
      <button class="menu-toggle" id="menuToggle" type="button" aria-label="Abrir menú">☰</button>
      <a class="app-brand" href="${APP_URL}/dashboard.html"><span class="mini-logo">A</span><span>Arcadia<span>Corps</span></span></a>
      <div class="header-user"><span class="presence-dot" title="En línea"></span><span>${escapeHtml(displayName)}</span></div>
    </header>
    <div class="sidebar-backdrop" id="sidebarBackdrop"></div>
    <aside class="app-sidebar" id="appSidebar" aria-label="Navegación principal">
      <div class="sidebar-profile">
        ${avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="" class="sidebar-avatar">` : `<div class="sidebar-avatar fallback">${escapeHtml(initial)}</div>`}
        <div><strong>${escapeHtml(displayName)}</strong><small>${escapeHtml(user.email || '')}</small><span class="role-pill role-${escapeHtml(role)}">${escapeHtml(ROLE_LABELS[role] || role)}</span></div>
      </div>
      <nav class="sidebar-nav">
        <details open>
          <summary>Principal <span>⌄</span></summary>
          <a class="${active('dashboard.html')}" href="${APP_URL}/dashboard.html">⌂ <span>Inicio</span></a>
          <a class="${active('profile.html')}" href="${APP_URL}/profile.html">◉ <span>Mi perfil</span></a>
          <a class="${active('news.html') || active('news-detail.html') || active('news-editor.html')}" href="${APP_URL}/news.html">▤ <span>Noticias</span></a>
          <a class="${active('tickets.html') || active('ticket-new.html') || active('ticket-detail.html')}" href="${APP_URL}/tickets.html">🎫 <span>Mis tickets</span></a>
          <a class="${active('purchases.html')}" href="${APP_URL}/purchases.html">🧾 <span>Mis compras</span></a>
        </details>
        ${['owner','staff'].includes(role) ? `<details open><summary>Soporte <span>⌄</span></summary><a class="${active('support-tickets.html')}" href="${APP_URL}/support-tickets.html">🛡 <span>Atender tickets</span></a></details>` : ''}
        ${role === 'owner' ? `<details open><summary>Administración <span>⌄</span></summary><a class="${active('admin-users.html')}" href="${APP_URL}/admin-users.html">♛ <span>Usuarios y roles</span></a></details>` : ''}
      </nav>
      <div class="sidebar-footer">
        <button id="shellLogout" class="sidebar-logout" type="button">Cerrar sesión</button>
        <small>ArcadiaCorps Web 2.0</small>
      </div>
    </aside>`;
  document.body.prepend(root);

  const sidebar = root.querySelector('#appSidebar');
  const backdrop = root.querySelector('#sidebarBackdrop');
  const closeMenu = () => document.body.classList.remove('sidebar-open');
  root.querySelector('#menuToggle').addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
  backdrop.addEventListener('click', closeMenu);
  root.querySelectorAll('.sidebar-nav a').forEach(link => link.addEventListener('click', closeMenu));
  root.querySelector('#shellLogout').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Cerrando…';
    await supabase.auth.signOut({ scope: 'local' });
    window.location.replace(`${APP_URL}/login.html?logout=1`);
  });
  return access;
}
