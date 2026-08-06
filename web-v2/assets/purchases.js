import { mountShell } from './shell.js?v=34';
import { getCurrentAccess } from './access.js';
import { supabase } from './auth.js';
const access = await getCurrentAccess(); if (!access) throw new Error('Sin sesión'); await mountShell();
const list = document.querySelector('#purchaseList');
const message = document.querySelector('#purchaseMessage');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = (v) => `S/ ${Number(v || 0).toFixed(2)}`;
const fmt = (v) => new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v));
const labels = {pending:'Pendiente',paid:'Pagado',processing:'Preparando',delivered:'Entregado',cancelled:'Cancelado',refunded:'Reembolsado'};
const params = new URLSearchParams(location.search);
if (params.get('created') === '1') {
  message.textContent = `✓ Pedido ${params.get('order') || ''} registrado correctamente. Ya puedes coordinar el pago por WhatsApp.`;
  message.className = 'message show ok';
}
const { data: orders, error } = await supabase.from('store_orders').select('*').eq('user_id', access.user.id).order('created_at',{ascending:false});
if (error) {
  list.innerHTML = `<div class="message show error">${esc(error.message)}</div>`;
} else if (!orders?.length) {
  list.innerHTML = '<div class="panel empty-state">Todavía no tienes pedidos registrados.</div>';
} else {
  const ids = orders.map(o => o.id);
  const { data: items, error: itemsError } = await supabase.from('store_order_items').select('*').in('order_id', ids).order('created_at');
  if (itemsError) list.innerHTML = `<div class="message show error">${esc(itemsError.message)}</div>`;
  else {
    const grouped = Object.groupBy ? Object.groupBy(items || [], i => i.order_id) : (items || []).reduce((acc,i)=>((acc[i.order_id] ||= []).push(i),acc),{});
    list.innerHTML = orders.map(order => `<article class="panel order-card">
      <header><div><span class="ticket-number">${esc(order.order_number)}</span><h2>Pack de ${Number(order.item_count || grouped[order.id]?.length || 0)} producto(s)</h2><p>${fmt(order.created_at)}</p></div><span class="order-status ${esc(order.status)}">${esc(labels[order.status] || order.status)}</span></header>
      <div class="order-items">${(grouped[order.id] || []).map(item => `<div><img src="${esc(item.logo_url || '')}" alt=""><span><strong>${esc(item.product_name)}</strong><small>${esc(item.category || '')}</small></span><b>${money(item.unit_price)}</b></div>`).join('')}</div>
      <footer><span>Total</span><strong>${money(order.total_amount)}</strong></footer>
      ${order.admin_note ? `<p class="order-note"><b>Nota de soporte:</b> ${esc(order.admin_note)}</p>` : ''}
    </article>`).join('');
  }
}
