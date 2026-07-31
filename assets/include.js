/* include.js — carga header/footer compartidos. */
function includePartial(id, url){
  return fetch(url).then(r => {
    if(!r.ok) throw new Error('HTTP '+r.status);
    return r.text();
  }).then(html => {
    document.getElementById(id).outerHTML = html;
  }).catch(e => console.error('No se pudo cargar', url, e));
}
Promise.all([
  includePartial('site-header','partials/header.html?v=ui-v7'),
  includePartial('site-footer','partials/footer.html?v=ui-v7')
]).then(() => {
  const core = document.createElement('script');
  core.src = 'assets/core.js?v=ui-v7';
  core.onload = () => {
    const app = document.createElement('script');
    app.src = 'assets/app.js?v=ui-v7';
    app.onload = () => {
      const support = document.createElement('script');
      support.src = 'assets/support-system.js?v=ui-v7';
      document.body.appendChild(support);
    };
    document.body.appendChild(app);
  };
  document.body.appendChild(core);
  document.dispatchEvent(new Event('partialsReady'));
});


// Resalta automáticamente la sección actual y aplica animaciones globales.
document.addEventListener('partialsReady',()=>{
  const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  document.querySelectorAll('.sidebar-link,.nav-links a').forEach(link=>{
    const href=(link.getAttribute('href')||'').split('?')[0].split('#')[0].toLowerCase();
    const active=href===page || (page==='index.html'&&href==='index.html');
    link.classList.toggle('active',active);
    if(active) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
  });
  const animated=document.querySelectorAll('main section, .card, .stream-card, .ticket-list-panel, .owner-card, .panel-card, .feature-card, .stat-card');
  animated.forEach((el,i)=>{el.classList.add('global-reveal');el.style.setProperty('--reveal-delay',`${Math.min(i%8,7)*55}ms`);});
  const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target);}}),{threshold:.08,rootMargin:'0px 0px -35px'});
  animated.forEach(el=>io.observe(el));
});
