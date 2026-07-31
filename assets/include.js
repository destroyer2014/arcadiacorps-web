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
  includePartial('site-header','partials/header.html?v=tickets-v1'),
  includePartial('site-footer','partials/footer.html?v=tickets-v1')
]).then(() => {
  const core = document.createElement('script');
  core.src = 'assets/core.js?v=tickets-v1';
  core.onload = () => {
    const app = document.createElement('script');
    app.src = 'assets/app.js?v=tickets-v1';
    app.onload = () => {
      const support = document.createElement('script');
      support.src = 'assets/support-system.js?v=tickets-v1';
      document.body.appendChild(support);
    };
    document.body.appendChild(app);
  };
  document.body.appendChild(core);
  document.dispatchEvent(new Event('partialsReady'));
});
