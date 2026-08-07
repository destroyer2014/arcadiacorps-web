(() => {
  const VERSION = '36.1';
  document.documentElement.dataset.arcadiaTheme = VERSION;
  document.body.classList.add('arcadia-v36-1');

  const revealSelector = [
    '.panel','.card','.ticket-card','.product-card','.order-card',
    '.news-card','.post-card','.command-group','.team-card',
    '.review-card','.subbot-card','.profile-card'
  ].join(',');

  function fixBrandLinks() {
    document.querySelectorAll('.app-brand').forEach(link => {
      link.href = '/web-v2/dashboard.html?v=36.1';
    });
  }

  function normalizeSidebar() {
    document.querySelectorAll('.sidebar-nav summary, .sidebar-nav summary *').forEach(el => {
      el.style.removeProperty('transform');
      el.style.removeProperty('rotate');
      el.style.removeProperty('writing-mode');
    });
  }

  function setupReveal() {
    const items = [...document.querySelectorAll(revealSelector)]
      .filter(el => !el.classList.contains('arc-reveal'));

    if (!items.length) return;

    if (
      window.matchMedia('(max-width: 760px)').matches ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !('IntersectionObserver' in window)
    ) {
      items.forEach(el => el.classList.add('arc-reveal','arc-visible'));
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('arc-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold:.06, rootMargin:'0px 0px -12px' });

    items.forEach(el => {
      el.classList.add('arc-reveal');
      observer.observe(el);
    });
  }

  function ensureFooter() {
    if (document.querySelector('.arcadia-global-footer')) return;

    const footer = document.createElement('footer');
    footer.className = 'arcadia-global-footer';
    footer.innerHTML = `
      <div class="arcadia-footer-inner">
        <div class="arcadia-footer-brand">
          <span class="arcadia-footer-mark">⚡</span>
          <span>ArcadiaCorps</span>
        </div>
        <p>© 2014 - 2026 ArcadiaCorps. Todos los derechos y usos reservados.</p>
      </div>`;
    document.body.appendChild(footer);
  }

  function run() {
    fixBrandLinks();
    normalizeSidebar();
    setupReveal();
    ensureFooter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded',run,{ once:true });
  } else {
    run();
  }

  // Solo una segunda pasada corta para contenido montado por módulos.
  window.addEventListener('load',() => {
    requestAnimationFrame(run);
  },{ once:true });
})();
