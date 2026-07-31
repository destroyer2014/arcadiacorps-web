/* core.js — Lógica crítica de navegación (sidebar, notificaciones, reveal).
   Se carga PRIMERO y de forma independiente, para que el menú y el
   contenido de la página siempre funcionen aunque algún bloque más
   grande de app.js (casino, muro social, etc.) falle en alguna página. */

(function(){
  try{
    const sidebar = document.getElementById('appSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const toggleBtn = document.getElementById('sidebarToggle');

    function openSidebar(){ sidebar?.classList.add('open'); overlay?.classList.add('open'); }
    function closeSidebar(){ sidebar?.classList.remove('open'); overlay?.classList.remove('open'); }

    toggleBtn?.addEventListener('click', openSidebar);
    overlay?.addEventListener('click', closeSidebar);
    sidebar?.querySelectorAll('.sidebar-link').forEach(a => a.addEventListener('click', closeSidebar));
  }catch(e){ console.error('[core.js] sidebar:', e); }
})();

(function(){
  try{
    const notifBtn = document.getElementById('notifBtn');
    const notifPanel = document.getElementById('notifPanel');
    const notifBadge = document.getElementById('notifBadge');

    notifBtn?.addEventListener('click', (e)=>{
      e.stopPropagation();
      notifPanel?.classList.toggle('open');
      if(notifPanel?.classList.contains('open')) notifBadge?.classList.add('hide');
    });
    document.addEventListener('click', (e)=>{
      if(notifPanel && notifPanel.classList.contains('open') && !notifPanel.contains(e.target) && e.target !== notifBtn){
        notifPanel.classList.remove('open');
      }
    });
  }catch(e){ console.error('[core.js] notif:', e); }
})();

(function(){
  try{
    if('IntersectionObserver' in window){
      const revealObserver = new IntersectionObserver((entries)=>{
        entries.forEach(entry=>{
          if(entry.isIntersecting){
            entry.target.classList.add('in-view');
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 });
      document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
    } else {
      document.querySelectorAll('.reveal').forEach(el => el.classList.add('in-view'));
    }
  }catch(e){ console.error('[core.js] reveal:', e); }
})();
