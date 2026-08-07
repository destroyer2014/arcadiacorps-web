import { mountShell } from './shell.js?v=36';
import { getCurrentAccess } from './access.js';
import { supabase } from './auth.js';

const access = await getCurrentAccess();
if (!access) throw new Error('Sin sesión');
await mountShell();

const PHONE = '51917611323';
const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money = (value) => `S/ ${Number(value || 0).toFixed(2)}`;
const labels = {streaming:'Streaming', musica:'Música', software:'Software', educacion:'Educación', servicios:'Servicios'};
const order = ['streaming','musica','software','educacion','servicios'];

const fallback = [
  {id:'netflix',name:'Netflix Premium 1 Pantalla',category:'streaming',label:'Streaming',price:15,old_price:20,badge:'-25%',logo_url:'assets/logos/netflix.svg',rating:'4.9',sales_text:'+120 ventas',featured:true,is_active:true},
  {id:'hbo',name:'HBO Max Premium',category:'streaming',label:'Streaming',price:14,old_price:18,badge:'Popular',logo_url:'assets/logos/hbo-max.svg',rating:'4.8',sales_text:'+70 ventas',featured:true,is_active:true},
  {id:'prime',name:'Prime Video',category:'streaming',label:'Streaming',price:12,old_price:14,badge:'-14%',logo_url:'assets/logos/prime-video.svg',rating:'4.9',sales_text:'+120 ventas',featured:true,is_active:true},
  {id:'disney',name:'Disney+ Premium',category:'streaming',label:'Streaming',price:16,old_price:22,badge:'-27%',logo_url:'assets/logos/disney-plus.svg',rating:'4.9',sales_text:'+120 ventas',is_active:true},
  {id:'crunchy',name:'Crunchyroll Mega Fan',category:'streaming',label:'Streaming',price:11,old_price:15,badge:'Nuevo',logo_url:'assets/logos/crunchyroll.svg',rating:'4.8',sales_text:'+40 ventas',is_active:true},
  {id:'spotify',name:'Spotify Premium Individual',category:'musica',label:'Música',price:10,old_price:14,badge:'-29%',logo_url:'assets/logos/spotify.svg',rating:'4.9',sales_text:'+120 ventas',is_active:true},
  {id:'canva',name:'Canva Pro',category:'software',label:'Software',price:18,old_price:25,badge:'-28%',logo_url:'assets/logos/canva.svg',rating:'4.9',sales_text:'+100 ventas',featured:true,is_active:true},
  {id:'duolingo',name:'Duolingo Super',category:'educacion',label:'Educación',price:18,old_price:22,badge:'-20%',logo_url:'assets/logos/duolingo.svg',rating:'4.8',sales_text:'+54 ventas',is_active:true},
  {id:'dyver',name:'Cuenta Dyver',category:'servicios',label:'Servicios',price:20,old_price:30,badge:'Digital',logo_url:'assets/logos/dyver.svg',rating:'4.9',sales_text:'+120 ventas',is_active:true}
];

let products = fallback;
let usingDatabase = false;
const { data: dbProducts, error: productsError } = await supabase
  .from('store_products')
  .select('*')
  .eq('is_active', true)
  .order('sort_order');
if (!productsError && dbProducts?.length) {
  products = dbProducts;
  usingDatabase = true;
}

let filter = 'all';
let query = '';
let cart = JSON.parse(localStorage.getItem('arcadia_cart_v26') || localStorage.getItem('arcadia_cart_v25') || '[]');
cart = cart.map(String);

function card(product) {
  return `<article class="product-card${product.sold_out ? ' soldout' : ''}">
    <span class="product-badge">${esc(product.badge || product.label || 'Digital')}</span>
    <button class="product-fav" type="button" aria-label="Favorito">♡</button>
    <div class="product-logo"><img src="${esc(product.logo_url || '')}" alt="${esc(product.name)}" loading="lazy"></div>
    <span class="product-category">${esc(product.label || labels[product.category] || product.category)}</span>
    <h3>${esc(product.name)}</h3>
    <div class="product-rating">★ ${esc(product.rating || '4.9')} <span>${esc(product.sales_text || '')}</span></div>
    <div class="product-price"><strong>${money(product.price)}</strong>${product.old_price ? `<del>${money(product.old_price)}</del>` : ''}</div>
    <button class="btn ${product.sold_out ? 'secondary' : 'primary'} product-buy" data-add="${esc(product.id)}" ${product.sold_out ? 'disabled' : ''}>${product.sold_out ? 'Sin stock' : 'Añadir al carrito'}</button>
  </article>`;
}

function render() {
  const list = products.filter((product) =>
    (filter === 'all' || product.category === filter) &&
    (!query || `${product.name} ${product.label || ''}`.toLowerCase().includes(query))
  );
  $('#featured').innerHTML = products.filter((product) => product.featured).map(card).join('');
  $('#categorySections').innerHTML = order.map((category) => {
    const items = list.filter((product) => product.category === category);
    return items.length ? `<section class="category-block">
      <div class="category-title"><h3>${labels[category]}</h3><div class="carousel-buttons"><button data-target="row-${category}" data-dir="-1">‹</button><button data-target="row-${category}" data-dir="1">›</button></div></div>
      <div class="product-carousel" id="row-${category}">${items.map(card).join('')}</div>
    </section>` : '';
  }).join('');
  $('#storeEmpty').hidden = Boolean(list.length);
}

function getCartItems() {
  return cart.map((id) => products.find((product) => String(product.id) === String(id))).filter(Boolean);
}
function saveCart() {
  localStorage.setItem('arcadia_cart_v26', JSON.stringify(cart));
  renderCart();
}
function renderCart() {
  const items = getCartItems();
  $('#cartCount').textContent = items.length;
  $('#cartItems').innerHTML = items.length ? items.map((product) => `<article class="cart-item">
    <img src="${esc(product.logo_url || '')}" alt="">
    <div><strong>${esc(product.name)}</strong><small>${esc(product.label || labels[product.category] || '')}</small><b>${money(product.price)}</b></div>
    <button data-remove="${esc(product.id)}" type="button" aria-label="Quitar">×</button>
  </article>`).join('') : '<div class="empty-state">Tu carrito está vacío.</div>';
  $('#cartSubtotal').textContent = money(items.reduce((sum, product) => sum + Number(product.price || 0), 0));
  $('#checkoutCart').disabled = !items.length;
}
function openCart() { document.body.classList.add('cart-open'); }
function closeCart() { document.body.classList.remove('cart-open'); }

async function createOrder(items) {
  if (!usingDatabase || items.some((item) => !/^[0-9a-f-]{36}$/i.test(String(item.id)))) {
    throw new Error('La tienda todavía no está conectada a la base de datos. Ejecuta store-orders-v26.sql.');
  }
  const productIds = items.map((item) => item.id);
  const { data, error } = await supabase.rpc('create_store_order', { product_ids: productIds });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.order_id) throw new Error('No se pudo confirmar el pedido.');
  return row;
}

$('#checkoutCart').onclick = async () => {
  const items = getCartItems();
  if (!items.length) return;
  const button = $('#checkoutCart');
  button.disabled = true;
  button.textContent = 'Registrando pedido…';
  try {
    const orderData = await createOrder(items);
    const total = Number(orderData.total_amount || items.reduce((sum, product) => sum + Number(product.price || 0), 0));
    const lines = items.map((product, index) => `${index + 1}. ${product.name} — ${money(product.price)}`).join('\n');
    const text = `Hola ArcadiaCorps, registré el pedido ${orderData.order_number}:\n\n${lines}\n\nTotal: ${money(total)}\nUsuario: ${access.profile?.username || access.user.email || ''}\nPor favor confirmen disponibilidad y método de pago.`;
    cart = [];
    saveCart();
    closeCart();
    sessionStorage.setItem('arcadia_order_created', orderData.order_number);
    window.open(`https://wa.me/${PHONE}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    location.href = `purchases.html?created=1&order=${encodeURIComponent(orderData.order_number)}`;
  } catch (error) {
    alert(error.message || 'No se pudo registrar el pedido.');
  } finally {
    button.disabled = false;
    button.textContent = 'Registrar pedido y abrir WhatsApp';
  }
};

document.addEventListener('click', (event) => {
  const add = event.target.closest('[data-add]');
  if (add) {
    if (!cart.includes(String(add.dataset.add))) cart.push(String(add.dataset.add));
    saveCart(); openCart(); return;
  }
  const remove = event.target.closest('[data-remove]');
  if (remove) { cart = cart.filter((id) => id !== String(remove.dataset.remove)); saveCart(); return; }
  const scroll = event.target.closest('[data-scroll],[data-target]');
  if (scroll) document.getElementById(scroll.dataset.scroll || scroll.dataset.target)?.scrollBy({left:Number(scroll.dataset.dir) * 320, behavior:'smooth'});
  const favorite = event.target.closest('.product-fav');
  if (favorite) { favorite.classList.toggle('active'); favorite.textContent = favorite.classList.contains('active') ? '♥' : '♡'; }
});

$('#storeTabs').addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  filter = button.dataset.filter;
  document.querySelectorAll('#storeTabs button').forEach((item) => item.classList.toggle('active', item === button));
  render();
});
$('#storeSearch').addEventListener('input', (event) => { query = event.target.value.trim().toLowerCase(); render(); });
$('#openCart').onclick = openCart;
$('#closeCart').onclick = closeCart;
$('#cartBackdrop').onclick = closeCart;
$('#clearCart').onclick = () => { cart = []; saveCart(); };

async function initDeal() {
  const { data } = await supabase.from('store_offers').select('*').eq('is_active', true).gt('ends_at', new Date().toISOString()).order('ends_at').limit(1).maybeSingle();
  if (!data) return;
  const banner = $('#dealBanner');
  banner.hidden = false;
  $('#dealTitle').textContent = data.title;
  $('#dealText').textContent = data.description || '';
  const tick = () => {
    const remaining = new Date(data.ends_at) - Date.now();
    if (remaining <= 0) { banner.hidden = true; return; }
    const values = {days:Math.floor(remaining/86400000), hours:Math.floor(remaining/3600000)%24, minutes:Math.floor(remaining/60000)%60, seconds:Math.floor(remaining/1000)%60};
    Object.entries(values).forEach(([key, value]) => { document.querySelector(`[data-time="${key}"]`).textContent = String(value).padStart(2, '0'); });
  };
  tick(); setInterval(tick, 1000);
}

render();
renderCart();
initDeal();
