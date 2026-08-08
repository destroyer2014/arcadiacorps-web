import { getCurrentAccess } from './access.js';
import { mountShell } from './shell.js?v=40.1';
import { supabase } from './auth.js';

const access = await getCurrentAccess();
if (!access) throw new Error('No hay sesión');

if (!['owner','staff'].includes(access.role)) {
  window.location.replace('./dashboard.html?v=36');
  throw new Error('No autorizado');
}

await mountShell();

const list = document.querySelector('#reviewAdminList');
const notice = document.querySelector('#reviewAdminNotice');
let filter = 'pending';
let profiles = new Map();

const esc = (value='') => String(value).replace(/[&<>'"]/g, char => ({
  '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
}[char]));

const stars = rating =>
  '★'.repeat(Number(rating || 0)) + '☆'.repeat(5-Number(rating || 0));

function showNotice(text,type='ok') {
  notice.textContent = text;
  notice.className = `message show ${type}`;
  setTimeout(()=>notice.className='message',3500);
}

function nameOf(id) {
  const p = profiles.get(id);
  return p?.full_name || p?.username || 'Moderador';
}

async function loadProfiles(ids) {
  const clean = [...new Set(ids.filter(Boolean))];
  if (!clean.length) return;
  const { data } = await supabase.from('profiles')
    .select('id,username,full_name')
    .in('id',clean);
  (data || []).forEach(row=>profiles.set(row.id,row));
}

async function loadCounts() {
  for (const status of ['pending','approved','rejected']) {
    const { count } = await supabase.from('arc_reviews')
      .select('id',{ count:'exact',head:true })
      .eq('status',status);
    const node = document.querySelector(`[data-count="${status}"]`);
    if (node) node.textContent = String(count || 0);
  }
}

async function loadReviews() {
  list.innerHTML = '<div class="review-admin-empty panel">Cargando reseñas…</div>';

  const { data,error } = await supabase.from('arc_reviews')
    .select('id,owner_id,user_name,avatar_url,rating,comment,status,moderated_by,moderated_at,created_at')
    .eq('status',filter)
    .order('created_at',{ ascending:false });

  if (error) {
    list.innerHTML = `<div class="review-admin-empty panel">${esc(error.message)}</div>`;
    return;
  }

  const rows = data || [];
  await loadProfiles(rows.map(row=>row.moderated_by));

  if (!rows.length) {
    list.innerHTML = `<div class="review-admin-empty panel">No hay reseñas ${filter === 'pending' ? 'pendientes' : filter === 'approved' ? 'aprobadas' : 'rechazadas'}.</div>`;
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
          <small>${new Date(row.created_at).toLocaleString('es-PE')}</small>
        </div>
        <span class="review-admin-stars">${stars(row.rating)}</span>
      </header>
      <span class="review-status ${esc(row.status)}">${esc(row.status)}</span>
      <p class="review-admin-comment">${esc(row.comment)}</p>
      ${row.moderated_by ? `<div class="review-moderation-meta">
        Moderada por ${esc(nameOf(row.moderated_by))}
        ${row.moderated_at ? `· ${new Date(row.moderated_at).toLocaleString('es-PE')}` : ''}
      </div>` : ''}
      <footer class="review-admin-actions">
        ${row.status === 'pending' ? `
          <button class="review-reject" type="button" data-status="rejected">Rechazar</button>
          <button class="review-approve" type="button" data-status="approved">Aprobar</button>
        ` : ''}
        <button class="review-delete" type="button" data-delete-review>Eliminar</button>
      </footer>
    </article>
  `).join('');
}

async function reload() {
  await Promise.all([loadCounts(),loadReviews()]);
}

document.querySelectorAll('[data-review-filter]').forEach(button => {
  button.addEventListener('click',async () => {
    filter = button.dataset.reviewFilter;
    document.querySelectorAll('[data-review-filter]').forEach(item=>item.classList.toggle('active',item===button));
    await loadReviews();
  });
});

list.addEventListener('click',async event => {
  const card = event.target.closest('[data-review-id]');
  if (!card) return;
  const reviewId = card.dataset.reviewId;
  const statusButton = event.target.closest('button[data-status]');
  const deleteButton = event.target.closest('button[data-delete-review]');

  if (statusButton) {
    const status = statusButton.dataset.status;
    card.querySelectorAll('button').forEach(item=>item.disabled=true);
    const { error } = await supabase.from('arc_reviews')
      .update({
        status,
        moderated_by:access.user.id,
        moderated_at:new Date().toISOString(),
        updated_at:new Date().toISOString()
      })
      .eq('id',reviewId);

    if (error) {
      showNotice(error.message,'error');
      card.querySelectorAll('button').forEach(item=>item.disabled=false);
      return;
    }
    showNotice(status === 'approved' ? 'Reseña aprobada.' : 'Reseña rechazada.');
    await reload();
  }

  if (deleteButton) {
    if (!confirm('¿Eliminar esta reseña definitivamente?')) return;
    deleteButton.disabled = true;
    const { error } = await supabase.from('arc_reviews')
      .delete()
      .eq('id',reviewId);
    if (error) {
      showNotice(error.message,'error');
      deleteButton.disabled = false;
      return;
    }
    showNotice('Reseña eliminada.');
    await reload();
  }
});

document.querySelector('#reloadReviews').addEventListener('click',reload);
reload();
