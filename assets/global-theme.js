(function(){
  'use strict';

  const ready = () => {
    const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

    // Active page state across the top navigation and sidebar.
    document.querySelectorAll('.sidebar-link, .nav-links a').forEach(link => {
      const raw = (link.getAttribute('href') || '').split('?')[0].split('#')[0];
      if(!raw || raw.startsWith('http') || raw === '#') return;
      const href = raw.split('/').pop().toLowerCase();
      const active = href === page || (!page && href === 'index.html');
      link.classList.toggle('active', active);
      if(active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    // Page identity class enables tailored accents without editing every document.
    document.body.classList.add('theme-global', 'page-' + page.replace('.html','').replace(/[^a-z0-9-]/g,''));

    // Progressive reveal, avoiding duplicates and keeping reduced-motion users safe.
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const candidates = document.querySelectorAll([
      'main > section','body > section','.panel','.card','.plan-card','.stream-card',
      '.ticket-card','.ticket-list-panel','.ticket-thread-panel','.support-card',
      '.owner-card','.owner-panel-card','.settings-card','.profile-section',
      '.accordion-item','.casino-panel','.top-panel','.social-card','.status-card',
      '.home-feature-card','.home-stat-card','.home-news-card'
    ].join(','));

    candidates.forEach((el, index) => {
      if(el.closest('#authGate') || el.classList.contains('global-motion-ready')) return;
      el.classList.add('global-motion-ready');
      el.style.setProperty('--global-delay', `${Math.min(index % 8, 7) * 55}ms`);
    });

    if(reduced || !('IntersectionObserver' in window)){
      candidates.forEach(el => el.classList.add('global-motion-in'));
    } else {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if(entry.isIntersecting){
            entry.target.classList.add('global-motion-in');
            observer.unobserve(entry.target);
          }
        });
      }, {threshold:0.08, rootMargin:'0px 0px -28px'});
      candidates.forEach(el => observer.observe(el));
    }

    // Add a subtle pointer light to large cards on desktop.
    if(matchMedia('(pointer:fine)').matches){
      document.querySelectorAll('.panel,.card,.stream-card,.owner-card,.ticket-card,.settings-card').forEach(card => {
        card.addEventListener('pointermove', event => {
          const rect = card.getBoundingClientRect();
          card.style.setProperty('--pointer-x', `${event.clientX - rect.left}px`);
          card.style.setProperty('--pointer-y', `${event.clientY - rect.top}px`);
        }, {passive:true});
      });
    }

    // Mobile-friendly header behavior.
    const nav = document.getElementById('nav');
    let lastY = scrollY;
    addEventListener('scroll', () => {
      if(!nav) return;
      const y = scrollY;
      nav.classList.toggle('nav-scrolled', y > 18);
      nav.classList.toggle('nav-hidden', y > lastY && y > 180 && !document.getElementById('appSidebar')?.classList.contains('open'));
      lastY = y;
    }, {passive:true});

    // Inputs receive a consistent filled state for clearer forms.
    document.querySelectorAll('input,textarea,select').forEach(control => {
      const sync = () => control.classList.toggle('has-value', Boolean(control.value));
      sync();
      control.addEventListener('input', sync);
      control.addEventListener('change', sync);
    });
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, {once:true});
  else setTimeout(ready, 0);
  document.addEventListener('partialsReady', () => setTimeout(ready, 50));
})();
