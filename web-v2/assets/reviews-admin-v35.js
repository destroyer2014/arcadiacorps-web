import { getCurrentAccess } from './access.js';
import { mountShell } from './shell.js?v=40.1';
import { supabase } from './auth.js';

const access = await getCurrentAccess();
if (!access) throw new Error('No hay sesión');

if (!['owner','staff'].includes(access.role)) {
  window.location.replace('./dashboard.html?v=35');
  throw new Error('No autorizado');
}

await mountShell();

const list = document.querySelector('#reviewAdminList');
const count = document.querySelector('#reviewPendingCount');
const notice = document.querySelector('#reviewAdminNotice');

const esc = (value='') => String(value).replace(/[&<>'"]/g, char => ({
  '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
}[char]));

const stars = rating => '★'.repeat(Number(rating || 0)) + '☆'.repeat(5-Number(rating || 0));

function showNotice(text, type='ok') {
  notice.textContent = text;
  notice.className = `message show ${type}`;
}

async function loadPending() {
  list.innerHTML = '<div class="review-admin-empty panel">Cargando reseñas…</div>';

  const { data, error } = await supabase
    .from('arc_reviews')
    .select('id,user_name,avatar_url,rating,comment,status,created_at')
    .eq('status','pending')
    .order('created_at',{ ascending:true });

  if (error) {
    list.innerHTML = `<div class="review-admin-empty panel">${esc(error.message)}</div>`;
    count.textContent = '!';
    return;
  }

  const rows = data || [];
  count.textContent = String(rows.length);

  if (!rows.length) {
    list.innerHTML = '<div class="review-admin-empty panel">No hay reseñas pendientes.</div>';
    return;
  }

  list.innerHTML = rows.map(row => `
    <article class="review-admin-card panel" data-review-id="${esc(row.id)}">
      <header class="review-admin-head">
        ${row.avatar_url
          ? `<img class="review-admin-avatar" src="${esc(row.avatar_url)}" alt="">`
          : `<div class="review-admin-avatar">${esc((row.user_name || 'U')[0])}</div>`}
        <div>
          <strong>${esc(row.user_name || 'Usuario')}</strong>
          <small>${new Date(row.created_at).toLocaleString('es')}</small>
        </div>
        <span class="review-admin-stars">${stars(row.rating)}</span>
      </header>
      <p class="review-admin-comment">${esc(row.comment)}</p>
      <footer class="review-admin-actions">
        <button class="review-reject" type="button" data-status="rejected">Rechazar</button>
        <button class="review-approve" type="button" data-status="approved">Aprobar</button>
      </footer>
    </article>
  `).join('');
}

list.addEventListener('click', async event => {
  const button = event.target.closest('button[data-status]');
  if (!button) return;

  const card = button.closest('[data-review-id]');
  const reviewId = card?.dataset.reviewId;
  const status = button.dataset.status;
  if (!reviewId || !['approved','rejected'].includes(status)) return;

  card.querySelectorAll('button').forEach(item => item.disabled = true);
  button.textContent = status === 'approved' ? 'Aprobando…' : 'Rechazando…';

  const { error } = await supabase
    .from('arc_reviews')
    .update({ status, updated_at:new Date().toISOString() })
    .eq('id',reviewId);

  if (error) {
    showNotice(error.message,'error');
    card.querySelectorAll('button').forEach(item => item.disabled = false);
    button.textContent = status === 'approved' ? 'Aprobar' : 'Rechazar';
    return;
  }

  showNotice(status === 'approved' ? 'Reseña aprobada.' : 'Reseña rechazada.');
  card.remove();
  const remaining = list.querySelectorAll('[data-review-id]').length;
  count.textContent = String(remaining);
  if (!remaining) {
    list.innerHTML = '<div class="review-admin-empty panel">No hay reseñas pendientes.</div>';
  }
});

document.querySelector('#reloadReviews').addEventListener('click', loadPending);
loadPending();
