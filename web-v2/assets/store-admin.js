import { supabase } from './auth.js';
import { requireRole } from './access.js';
import { mountShell } from './shell.js?v=40.1';
const access = await requireRole(['owner']); if (!access) throw new Error('Sin permiso'); await mountShell();
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = (v) => `S/ ${Number(v || 0).toFixed(2)}`;
const fmt = (v) => new Intl.DateTimeFormat('es-PE',{dateStyle:'short',timeStyle:'short'}).format(new Date(v));
let products = [];
const msg = (text, ok=false) => { const el=$('#storeAdminMessage'); el.textContent=text; el.className=`message show ${ok?'ok':'error'}`; };
async function loadProducts(){
  const {data,error}=await supabase.from('store_products').select('*').order('sort_order');
  if(error)return msg(error.message);
  products=data||[];
  $('#adminProducts').innerHTML=products.map(p=>`<article><div><strong>${esc(p.name)}</strong><small>${esc(p.category)} · ${money(p.price)} · ${p.is_active?'Visible':'Oculto'}</small></div><div><button class="admin-edit-btn" data-edit="${p.id}">Editar</button><button class="admin-delete-btn" data-delete="${p.id}">Eliminar</button></div></article>`).join('')||'<div class="empty-state">No hay productos.</div>';
}
function reset(){['#productId','#productName','#productPrice','#productOldPrice','#productBadge','#productLogo'].forEach(s=>$(s).value='');$('#productCategory').value='streaming';$('#productOrder').value=0;$('#productFeatured').checked=false;$('#productSoldout').checked=false;$('#productActive').checked=true;}
$('#productForm').onsubmit=async e=>{e.preventDefault();const id=$('#productId').value;const payload={name:$('#productName').value.trim(),category:$('#productCategory').value,label:$('#productCategory').selectedOptions[0].text,price:Number($('#productPrice').value),old_price:$('#productOldPrice').value?Number($('#productOldPrice').value):null,badge:$('#productBadge').value.trim(),logo_url:$('#productLogo').value.trim(),sort_order:Number($('#productOrder').value||0),featured:$('#productFeatured').checked,sold_out:$('#productSoldout').checked,is_active:$('#productActive').checked,updated_at:new Date().toISOString()};const q=id?supabase.from('store_products').update(payload).eq('id',id):supabase.from('store_products').insert(payload);const{error}=await q;if(error)return msg(error.message);msg('Producto guardado.',true);reset();loadProducts();};
$('#resetProduct').onclick=reset;
$('#adminProducts').onclick=async e=>{const edit=e.target.closest('[data-edit]');if(edit){const p=products.find(x=>String(x.id)===edit.dataset.edit);if(!p)return;$('#productId').value=p.id;$('#productName').value=p.name;$('#productCategory').value=p.category;$('#productPrice').value=p.price;$('#productOldPrice').value=p.old_price||'';$('#productBadge').value=p.badge||'';$('#productLogo').value=p.logo_url||'';$('#productOrder').value=p.sort_order||0;$('#productFeatured').checked=!!p.featured;$('#productSoldout').checked=!!p.sold_out;$('#productActive').checked=!!p.is_active;scrollTo({top:0,behavior:'smooth'});}const del=e.target.closest('[data-delete]');if(del&&confirm('¿Eliminar este producto?')){const{error}=await supabase.from('store_products').delete().eq('id',del.dataset.delete);if(error)return msg(error.message);loadProducts();}};
$('#offerForm').onsubmit=async e=>{e.preventDefault();await supabase.from('store_offers').update({is_active:false}).neq('id','00000000-0000-0000-0000-000000000000');const{error}=await supabase.from('store_offers').insert({title:$('#offerTitle').value.trim(),description:$('#offerDescription').value.trim(),ends_at:new Date($('#offerEnds').value).toISOString(),is_active:$('#offerActive').checked});if(error)return msg(error.message);msg('Oferta guardada.',true);};
const statusLabels={pending:'Pendiente',paid:'Pagado',processing:'Preparando',delivered:'Entregado',cancelled:'Cancelado',refunded:'Reembolsado'};
async function loadOrders(){
  $('#adminOrders').innerHTML='<div class="empty-state">Cargando…</div>';
  const {data:orders,error}=await supabase.from('store_orders').select('*').order('created_at',{ascending:false}).limit(100);
  if(error){$('#adminOrders').innerHTML=`<div class="message show error">${esc(error.message)}</div>`;return;}
  if(!orders?.length){$('#adminOrders').innerHTML='<div class="empty-state">No hay pedidos todavía.</div>';return;}
  const userIds=[...new Set(orders.map(o=>o.user_id))];
  const orderIds=orders.map(o=>o.id);
  const [{data:profiles},{data:items}]=await Promise.all([supabase.from('profiles').select('id,username,full_name,email').in('id',userIds),supabase.from('store_order_items').select('*').in('order_id',orderIds).order('created_at')]);
  const profileMap=Object.fromEntries((profiles||[]).map(x=>[x.id,x]));
  const grouped=(items||[]).reduce((a,i)=>((a[i.order_id] ||= []).push(i),a),{});
  $('#adminOrders').innerHTML=orders.map(o=>{const profile=profileMap[o.user_id];return `<article class="admin-order-card" data-order="${o.id}"><header><div><span class="ticket-number">${esc(o.order_number)}</span><strong>${esc(profile?.full_name||profile?.username||profile?.email||'Usuario')}</strong><small>${fmt(o.created_at)}</small></div><b>${money(o.total_amount)}</b></header><div class="admin-order-products">${(grouped[o.id]||[]).map(i=>`<span>${esc(i.product_name)}</span>`).join('')}</div><div class="admin-order-controls"><select data-order-status><option value="pending" ${o.status==='pending'?'selected':''}>Pendiente</option><option value="paid" ${o.status==='paid'?'selected':''}>Pagado</option><option value="processing" ${o.status==='processing'?'selected':''}>Preparando</option><option value="delivered" ${o.status==='delivered'?'selected':''}>Entregado</option><option value="cancelled" ${o.status==='cancelled'?'selected':''}>Cancelado</option><option value="refunded" ${o.status==='refunded'?'selected':''}>Reembolsado</option></select><input data-order-note value="${esc(o.admin_note||'')}" placeholder="Nota para el usuario"><button class="btn primary" data-save-order type="button">Guardar</button></div></article>`;}).join('');
}
$('#adminOrders').onclick=async e=>{const button=e.target.closest('[data-save-order]');if(!button)return;const card=button.closest('[data-order]');button.disabled=true;const{error}=await supabase.from('store_orders').update({status:card.querySelector('[data-order-status]').value,admin_note:card.querySelector('[data-order-note]').value.trim(),updated_at:new Date().toISOString()}).eq('id',card.dataset.order);if(error)msg(error.message);else msg('Pedido actualizado.',true);button.disabled=false;};
$('#refreshOrders').onclick=loadOrders;
await Promise.all([loadProducts(),loadOrders()]);
