import { supabase } from './auth.js';
import { APP_URL } from './config.js';
import { getCurrentAccess, ROLE_LABELS } from './access.js';

const esc = (value='') => String(value).replace(/[&<>'"]/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
}[c]));

const active = (...paths) =>
  paths.some(path => window.location.pathname.endsWith(path)) ? ' active' : '';

function link(href, icon, label, paths=[href], extra='') {
  return `<a class="${active(...paths)}" href="${APP_URL}/${href}" ${extra}>
    <span class="nav-icon">${icon}</span><span>${label}</span>
  </a>`;
}

export async function mountShell() {
  const existing = document.querySelector('#arcadiaShell');
  if (existing) return getCurrentAccess();

  const access = await getCurrentAccess();
  if (!access) return null;

  const { profile, user, role } = access;
  const displayName =
    profile.full_name ||
    profile.username ||
    user.email?.split('@')[0] ||
    'Usuario';

  const avatarUrl =
    profile.avatar_url ||
    user.user_metadata?.avatar_url ||
    user.user_metadata?.picture ||
    '';

  const initial = displayName.slice(0,1).toUpperCase();

  document.body.classList.add('with-app-shell');

  const root = document.createElement('div');
  root.id = 'arcadiaShell';
  root.innerHTML = `
    <header class="app-header">
      <button class="menu-toggle" id="menuToggle" type="button" aria-label="Abrir menú">☰</button>

      <a class="app-brand" href="${APP_URL}/dashboard.html?v=36">
        <img class="app-brand-logo"
             src="${APP_URL}/assets/images/arcadia-logo-rpg.png"
             alt="ArcadiaCorps">
        <span>Arcadia<span>Corps</span></span>
      </a>

      <div id="arcadiaHeaderActions" class="arcadia-header-actions"></div>
    </header>

    <div class="sidebar-backdrop" id="sidebarBackdrop"></div>

    <aside class="app-sidebar" id="appSidebar" aria-label="Navegación principal">
      <div class="sidebar-profile">
        <div class="sidebar-avatar-wrap">
          ${avatarUrl
            ? `<img src="${esc(avatarUrl)}" alt="" class="sidebar-avatar">`
            : `<div class="sidebar-avatar fallback">${esc(initial)}</div>`}
          <span class="arc-presence-dot" data-presence-user="${esc(user.id)}"></span>
        </div>
        <div>
          <strong>${esc(displayName)}</strong>
          <small>${esc(user.email || '')}</small>
          <span id="sidebarPresenceText" class="sidebar-presence-text">Conectando…</span>
          <span class="role-pill role-${esc(role)}">${esc(ROLE_LABELS[role] || role)}</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <details open>
          <summary><span><span class="nav-section-icon">🏰</span>Portal</span><span>⌄</span></summary>
          ${link('dashboard.html?v=36','⌂','Inicio',['dashboard.html'])}
          ${link('profile.html','◉','Mi perfil',['profile.html'])}
          ${link('news.html','▤','Noticias',['news.html','news-detail.html','news-editor.html'])}
        </details>

        <details open>
          <summary><span><span class="nav-section-icon">✦</span>Social</span><span>⌄</span></summary>
          ${link('social.html','◎','Comunidad',['social.html'])}
          ${link('chat.html','✉','Chat',['chat.html'])}
        </details>

        <details open>
          <summary><span><span class="nav-section-icon">🧠</span>IA’s</span><span>⌄</span></summary>
          ${link('ais.html#chatgpt','◈','ChatGPT',['ais.html'])}
          ${link('ais.html#claude','◆','Claude',['ais.html'])}
          ${link('ais.html#image-prompt','▧','Imagen a Prompt',['ais.html'])}
          ${link('ais.html#nano-banana','✦','Nano Banana',['ais.html'])}
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
            <a class="${active('reviews-admin.html')}" href="${APP_URL}/reviews-admin.html">
              <span class="nav-icon">★</span>
              <span>Moderar reseñas</span>
              <span id="reviewPendingBadge" class="nav-count" hidden>0</span>
            </a>
          </details>
        ` : ''}

        ${role === 'owner' ? `
          <details open>
            <summary><span><span class="nav-section-icon">♛</span>Administración</span><span>⌄</span></summary>
            ${link('admin-users.html','♛','Usuarios y roles',['admin-users.html'])}
            ${link('store-admin.html','🛍','Administrar tienda',['store-admin.html'])}
          </details>
        ` : ''}
      </nav>

      <div class="sidebar-footer">
        <button id="shellLogout" class="sidebar-logout" type="button">Cerrar sesión</button>
        <div class="sidebar-credits">
          <strong>ArcadiaCorps</strong>
          <small>© 2014 - 2026 ArcadiaCorps.<br>Todos los derechos y usos reservados.</small>
        </div>
      </div>
    </aside>`;

  document.body.prepend(root);

  const backdrop = root.querySelector('#sidebarBackdrop');
  const closeMenu = () => document.body.classList.remove('sidebar-open');

  root.querySelector('#menuToggle').addEventListener('click', () => {
    document.body.classList.toggle('sidebar-open');
  });

  backdrop.addEventListener('click', closeMenu);
  root.querySelectorAll('.sidebar-nav a').forEach(item => item.addEventListener('click',closeMenu));

  root.querySelector('#shellLogout').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Cerrando…';
    await supabase.auth.signOut({ scope:'local' });
    window.location.replace(`${APP_URL}/login.html?logout=1`);
  });

  if (['owner','staff'].includes(role)) {
    supabase
      .from('arc_reviews')
      .select('id',{ count:'exact',head:true })
      .eq('status','pending')
      .then(({ count }) => {
        const badge = root.querySelector('#reviewPendingBadge');
        const total = Number(count || 0);
        if (!badge || !total) return;
        badge.textContent = total > 99 ? '99+' : String(total);
        badge.hidden = false;
      })
      .catch(() => {});
  }

  return access;
}
