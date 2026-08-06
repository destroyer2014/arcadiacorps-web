import { supabase } from './auth.js';
import { APP_URL } from './config.js';
import { getCurrentAccess, ROLE_LABELS } from './access.js';

const esc = (value='') => String(value).replace(/[&<>'"]/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
}[c]));

const active = (...paths) => paths.some(path => window.location.pathname.endsWith(path)) ? ' active' : '';

function link(href, icon, label, paths=[href]) {
  return `<a class="${active(...paths)}" href="${APP_URL}/${href}"><span class="nav-icon">${icon}</span><span>${label}</span></a>`;
}

export async function mountShell() {
  const access = await getCurrentAccess();
  if (!access) return null;

  const { profile, user, role } = access;
  const displayName = profile.full_name || profile.username || user.email?.split('@')[0] || 'Usuario';
  const avatarUrl = profile.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || '';
  const initial = displayName.slice(0,1).toUpperCase();

  document.body.classList.add('with-app-shell');

  const root = document.createElement('div');
  root.id = 'arcadiaShell';
  root.innerHTML = `
    <header class="app-header">
      <button class="menu-toggle" id="menuToggle" type="button" aria-label="Abrir menú">☰</button>
      <a class="app-brand" href="${APP_URL}/dashboard.html?v=33">
        <img class="app-brand-logo" src="${APP_URL}/assets/images/arcadia-logo-rpg.png" alt="ArcadiaCorps">
        <span>Arcadia<span>Corps</span></span>
      </a>
      <div class="header-user"><span class="presence-dot" title="En línea"></span><span>${esc(displayName)}</span></div>
    </header>

    <div class="sidebar-backdrop" id="sidebarBackdrop"></div>

    <aside class="app-sidebar" id="appSidebar" aria-label="Navegación principal">
      <div class="sidebar-profile">
        ${avatarUrl
          ? `<img src="${esc(avatarUrl)}" alt="" class="sidebar-avatar">`
          : `<div class="sidebar-avatar fallback">${esc(initial)}</div>`}
        <div>
          <strong>${esc(displayName)}</strong>
          <small>${esc(user.email || '')}</small>
          <span class="role-pill role-${esc(role)}">${esc(ROLE_LABELS[role] || role)}</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <details open>
          <summary><span><span class="nav-section-icon">🏰</span>Portal</span><span>⌄</span></summary>
          ${link('dashboard.html?v=33','⌂','Inicio',['dashboard.html'])}
          ${link('profile.html','◉','Mi perfil',['profile.html'])}
          ${link('news.html','▤','Noticias',['news.html','news-detail.html','news-editor.html'])}
        </details>

        <details open>
          <summary><span><span class="nav-section-icon">✦</span>Social</span><span>⌄</span></summary>
          ${link('social.html','◎','Comunidad',['social.html'])}
          ${link('chat.html','✉','Chat',['chat.html'])}
        </details>

        <details open>
          <summary><span><span class="nav-section-icon">🛍</span>Arcadia Shop</span><span>⌄</span></summary>
          ${link('store.html','🛍','Tienda',['store.html'])}
          ${link('purchases.html','🧾','Mis compras',['purchases.html'])}
        </details>

        <details open>
          <summary><span><span class="nav-section-icon">⚙</span>Servicios</span><span>⌄</span></summary>
          ${link('subbots.html','🤖','Mis Sub-Bots',['subbots.html'])}
          ${link('tickets.html','🎫','Mis tickets',['tickets.html','ticket-new.html','ticket-detail.html'])}
        </details>

        ${['owner','staff'].includes(role) ? `
        <details open>
          <summary><span><span class="nav-section-icon">🛡</span>Soporte</span><span>⌄</span></summary>
          ${link('support-tickets.html','🛡','Atender tickets',['support-tickets.html'])}
        </details>` : ''}

        ${role === 'owner' ? `
        <details open>
          <summary><span><span class="nav-section-icon">♛</span>Administración</span><span>⌄</span></summary>
          ${link('admin-users.html','♛','Usuarios y roles',['admin-users.html'])}
          ${link('store-admin.html','🛍','Administrar tienda',['store-admin.html'])}
        </details>` : ''}
      </nav>

      <div class="sidebar-footer">
        <button id="shellLogout" class="sidebar-logout" type="button">Cerrar sesión</button>
        <small>ArcadiaCorps RPG Neon v33</small>
      </div>
    </aside>`;

  document.body.prepend(root);

  const backdrop = root.querySelector('#sidebarBackdrop');
  const closeMenu = () => document.body.classList.remove('sidebar-open');

  root.querySelector('#menuToggle').addEventListener('click', () => {
    document.body.classList.toggle('sidebar-open');
  });
  backdrop.addEventListener('click', closeMenu);
  root.querySelectorAll('.sidebar-nav a').forEach(a => a.addEventListener('click', closeMenu));

  root.querySelector('#shellLogout').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Cerrando…';
    await supabase.auth.signOut({ scope:'local' });
    window.location.replace(`${APP_URL}/login.html?logout=1`);
  });

  return access;
}
