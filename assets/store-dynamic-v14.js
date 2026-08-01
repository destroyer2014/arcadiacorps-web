(function(){
'use strict';
const URL='https://dtfecbsokpgzyuiyxyvm.supabase.co';
const KEY='sb_publishable_SU7zJytoYMgoGtYoobINDQ_qLSO0bw1';
const REST=URL+'/rest/v1/store_products';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let products=[],tab='tendencias',category='all',query='',expanded=false;
const money=n=>'S/ '+Number(n||0).toFixed(2);
function wa(p){const msg=p.whatsapp_message||('Hola, quiero comprar '+p.name);return 'https://wa.me/51917611323?text='+encodeURIComponent(msg);}
function card(p,grid=true){
 const sold=Number(p.stock)<=0, tabs=(p.tabs||[]).join(' '), badge=sold?'Agotado':(p.badge||'Disponible');
 return `<article class="stream-card ${grid?'stream-grid-card':''} ${sold?'soldout-card':''}" data-product-id="${p.id}" data-category="${esc(p.category)}" data-tab="${esc(tabs)}" data-search="${esc((p.name+' '+p.category+' '+(p.description||'')).toLowerCase())}">
 <span class="stream-card-badge ${sold?'neutral':''}">${esc(badge)}</span><button type="button" class="stream-card-fav" aria-label="Favorito">♡</button><div class="stream-card-glow"></div>
 <div class="stream-card-logo"><img src="${esc(p.logo_url||'assets/logos/dyver.svg')}" alt="${esc(p.name)}" loading="lazy"></div>
 <span class="stream-card-category">${esc(p.category)}</span><h3>${esc(p.name)}</h3>
 <p class="store-dynamic-description">${esc(p.description||'Entrega rápida y soporte personalizado.')}</p>
 <div class="stream-card-rating">★ ${Number(p.rating||4.9).toFixed(1)} <span>+${Number(p.sales_count||0)} ventas</span></div>
 <div class="stream-card-price-row"><strong>${money(p.price)}</strong>${p.old_price?`<span>${money(p.old_price)}</span>`:''}</div>
 <div class="store-stock ${sold?'is-empty':''}">${sold?'Sin stock':p.stock+' disponibles'}</div>
 <div class="stream-card-footer"><span>${sold?'Consulta reposición':'⚡ Compra directa por WhatsApp'}</span><a href="${wa(p)}" target="_blank" rel="noopener">${sold?'Consultar stock':'Compra directa'}</a></div></article>`;
}
function visible(){return products.filter(p=>(category==='all'||p.category===category)&&((p.tabs||[]).includes(tab))&&(!query||(`${p.name} ${p.category} ${p.description||''}`).toLowerCase().includes(query)));}
function render(){const grid=document.getElementById('streamProductGrid'),no=document.getElementById('streamNoResults'),more=document.getElementById('streamLoadMore');if(!grid)return;const rows=visible(),shown=expanded?rows:rows.slice(0,8);grid.innerHTML=shown.map(p=>card(p,true)).join('');no.style.display=rows.length?'none':'block';more.hidden=rows.length<=8;more.textContent=expanded?'Ver menos productos':'Ver más productos';bindFav(grid);}
function bindFav(scope){scope.querySelectorAll('.stream-card-fav').forEach(b=>b.onclick=()=>{b.classList.toggle('active');b.textContent=b.classList.contains('active')?'♥':'♡';});}
function replaceControl(el,handler){if(!el)return null;const n=el.cloneNode(true);el.replaceWith(n);handler(n);return n;}
function bind(){
 document.querySelectorAll('.stream-tab').forEach(el=>replaceControl(el,n=>n.onclick=()=>{tab=n.dataset.tab;document.querySelectorAll('.stream-tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));expanded=false;render();}));
 document.querySelectorAll('.stream-chip').forEach(el=>replaceControl(el,n=>n.onclick=()=>{category=n.dataset.category;document.querySelectorAll('.stream-chip').forEach(x=>x.classList.toggle('active',x.dataset.category===category));expanded=false;render();}));
 replaceControl(document.getElementById('streamSearch'),n=>n.oninput=()=>{query=n.value.trim().toLowerCase();expanded=false;render();});
 replaceControl(document.getElementById('streamLoadMore'),n=>n.onclick=()=>{expanded=!expanded;render();});
}
async function load(){try{const r=await fetch(REST+'?select=*&is_active=eq.true&order=sort_order.asc,created_at.desc',{headers:{apikey:KEY,Authorization:'Bearer '+KEY}});if(!r.ok)throw new Error('HTTP '+r.status);products=await r.json();if(!products.length)return;bind();render();const track=document.getElementById('streamRecommendTrack');if(track){const rec=products.filter(p=>p.is_featured&&p.is_active).slice(0,6);track.innerHTML=(rec.length?rec:products.slice(0,4)).map(p=>card(p,false)).join('');bindFav(track);}document.body.classList.add('store-dynamic-ready');}catch(e){console.warn('[store v14] se conserva el catálogo HTML:',e);}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();