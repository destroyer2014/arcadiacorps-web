/* include.js — carga header/footer compartidos.
   Requiere servirse por http(s); no funciona abriendo el archivo con file:// */
function includePartial(id, url){
  return fetch(url).then(r => {
    if(!r.ok) throw new Error('HTTP '+r.status);
    return r.text();
  }).then(html => {
    document.getElementById(id).outerHTML = html;
  }).catch(e => console.error('No se pudo cargar', url, e));
}
Promise.all([
  includePartial('site-header','partials/header.html'),
  includePartial('site-footer','partials/footer.html')
]).then(() => {
  const s = document.createElement('script');
  s.src = 'assets/app.js';
  document.body.appendChild(s);
  document.dispatchEvent(new Event('partialsReady'));
});
