(() => {
  const VERSION = '33';
  document.documentElement.dataset.arcadiaTheme = VERSION;

  const revealSelector = [
    '.panel','.card','.ticket-card','.product-card','.order-card',
    '.news-card','.post-card','.command-group','.team-card','.review-card'
  ].join(',');

  const setupReveal = () => {
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
    }, { threshold: .08, rootMargin: '0px 0px -18px' });
    items.forEach(el => observer.observe(el));
  };

  const setupRipples = () => {
    document.addEventListener('pointerdown', event => {
      const target = event.target.closest('button,.btn,.quick-link,.sidebar-nav a');
      if (!target || target.disabled) return;
      const style = getComputedStyle(target);
      if (style.position === 'static') target.style.position = 'relative';
      target.style.overflow = 'hidden';
      const rect = target.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'arc-ripple';
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size/2}px`;
      ripple.style.top = `${event.clientY - rect.top - size/2}px`;
      target.appendChild(ripple);
      setTimeout(() => ripple.remove(), 650);
    }, { passive: true });
  };

  const fixBrandLinks = () => {
    document.querySelectorAll('.app-brand').forEach(link => {
      link.href = '/web-v2/dashboard.html?v=33';
    });
  };

  const run = () => {
    setupReveal();
    setupRipples();
    fixBrandLinks();
    const mo = new MutationObserver(() => {
      setupReveal();
      fixBrandLinks();
    });
    mo.observe(document.body, { childList:true, subtree:true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once:true });
  } else run();
})();
