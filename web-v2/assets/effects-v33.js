(() => {
  const VERSION = '34';
  document.documentElement.dataset.arcadiaTheme = VERSION;
  document.body.classList.add('arcadia-v34');

  const revealSelector = [
    '.panel','.card','.ticket-card','.product-card','.order-card',
    '.news-card','.post-card','.command-group','.team-card',
    '.review-card','.subbot-card','.profile-card'
  ].join(',');

  function fixBrandLinks() {
    document.querySelectorAll('.app-brand').forEach(link => {
      link.href = '/web-v2/dashboard.html?v=34';
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

    items.forEach(el => el.classList.add('arc-reveal'));

    if (!('IntersectionObserver' in window)) {
      items.forEach(el => el.classList.add('arc-visible'));
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('arc-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold:.07, rootMargin:'0px 0px -10px' });

    items.forEach(el => observer.observe(el));
  }

  function ensureFooter() {
    const old = document.querySelector('.arcadia-global-footer');
    if (old) return;

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

    const observer = new MutationObserver(() => {
      fixBrandLinks();
      normalizeSidebar();
      setupReveal();
      ensureFooter();
    });
    observer.observe(document.body, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once:true });
  } else {
    run();
  }
})();
