import { mountShell } from './shell.js';
import { getCurrentAccess } from './access.js';

const access = await getCurrentAccess();
if (!access) throw new Error('Sin sesión');
await mountShell();

const phone = '51972564492';
const products = [
  {id:'netflix',name:'Netflix Premium 1 Pantalla',category:'streaming',label:'Streaming',price:15,old:20,badge:'-25%',logo:'netflix.svg',rating:'4.9',sales:'+120 ventas',featured:true},
  {id:'hbo',name:'HBO Max Premium',category:'streaming',label:'Streaming',price:14,old:18,badge:'Agotado',logo:'hbo-max.svg',rating:'4.8',sales:'+70 ventas',soldout:true,featured:true},
  {id:'prime',name:'Prime Video',category:'streaming',label:'Streaming',price:12,old:14,badge:'-25%',logo:'prime-video.svg',rating:'4.9',sales:'+120 ventas',featured:true},
  {id:'disney',name:'Disney+ Premium',category:'streaming',label:'Streaming',price:16,old:22,badge:'-27%',logo:'disney-plus.svg',rating:'4.9',sales:'+120 ventas'},
  {id:'crunchy',name:'Crunchyroll Mega Fan',category:'streaming',label:'Streaming',price:11,old:15,badge:'Nuevo',logo:'crunchyroll.svg',rating:'4.8',sales:'+40 ventas'},
  {id:'spotify',name:'Spotify Premium Individual',category:'musica',label:'Música',price:10,old:14,badge:'-29%',logo:'spotify.svg',rating:'4.9',sales:'+120 ventas'},
  {id:'canva',name:'Canva Pro',category:'software',label:'Software',price:18,old:25,badge:'-28%',logo:'canva.svg',rating:'4.9',sales:'+100 ventas',featured:true},
  {id:'duolingo',name:'Duolingo Super',category:'educacion',label:'Educación',price:18,old:22,badge:'-20%',logo:'duolingo.svg',rating:'4.8',sales:'+54 ventas'},
  {id:'dyver',name:'Cuenta Dyver',category:'servicios',label:'Servicios',price:20,old:30,badge:'Digital',logo:'dyver.svg',rating:'4.9',sales:'+120 ventas'}
];
const order = ['streaming','musica','software','educacion','servicios'];
const labels = {streaming:'Streaming',musica:'Música',software:'Software',educacion:'Educación',servicios:'Servicios'};
let filter='all', query='';
const featured=document.querySelector('#featured');
const sections=document.querySelector('#categorySections');
const empty=document.querySelector('#storeEmpty');

function card(p){
 const text=encodeURIComponent(`Hola, quiero ${p.soldout?'consultar stock de':'comprar'} ${p.name}`);
 return `<article class="product-card${p.soldout?' soldout':''}" data-name="${p.name.toLowerCase()}" data-category="${p.category}">
  <span class="product-badge">${p.badge}</span><button class="product-fav" type="button" aria-label="Favorito">♡</button>
  <div class="product-logo"><img src="assets/logos/${p.logo}" alt="${p.name}" loading="lazy"></div>
  <span class="product-category">${p.label}</span><h3>${p.name}</h3>
  <div class="product-rating">★ ${p.rating} <span>${p.sales}</span></div>
  <div class="product-price"><strong>S/ ${p.price.toFixed(2)}</strong><del>S/ ${p.old.toFixed(2)}</del></div>
  <a class="btn ${p.soldout?'secondary':'primary'} product-buy" target="_blank" rel="noopener" href="https://wa.me/${phone}?text=${text}">${p.soldout?'Consultar stock':'Comprar ahora'}</a>
 </article>`;
}
featured.innerHTML=products.filter(p=>p.featured).map(card).join('');
function render(){
 const list=products.filter(p=>(filter==='all'||p.category===filter)&&(!query||p.name.toLowerCase().includes(query)||p.label.toLowerCase().includes(query)));
 sections.innerHTML=order.map(cat=>{const items=list.filter(p=>p.category===cat);if(!items.length)return'';return `<section class="category-block"><div class="category-title"><h3>${labels[cat]}</h3><div class="carousel-buttons"><button data-target="row-${cat}" data-dir="-1">‹</button><button data-target="row-${cat}" data-dir="1">›</button></div></div><div class="product-carousel" id="row-${cat}">${items.map(card).join('')}</div></section>`}).join('');
 empty.hidden=!!list.length;
}
render();
document.querySelector('#storeTabs').addEventListener('click',e=>{const b=e.target.closest('button[data-filter]');if(!b)return;filter=b.dataset.filter;document.querySelectorAll('#storeTabs button').forEach(x=>x.classList.toggle('active',x===b));render();});
document.querySelector('#storeSearch').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();render();});
document.addEventListener('click',e=>{const b=e.target.closest('[data-scroll],[data-target]');if(!b)return;const el=document.getElementById(b.dataset.scroll||b.dataset.target);el?.scrollBy({left:Number(b.dataset.dir)*Math.max(280,el.clientWidth*.75),behavior:'smooth'});});
document.addEventListener('click',e=>{const b=e.target.closest('.product-fav');if(!b)return;b.classList.toggle('active');b.textContent=b.classList.contains('active')?'♥':'♡';});
