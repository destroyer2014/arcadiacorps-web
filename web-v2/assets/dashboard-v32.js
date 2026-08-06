import './dashboard-v31.js';
import { supabase } from './auth.js';
const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const track=document.querySelector('#reviewsTrack'),avg=document.querySelector('#averageRating'),stars=document.querySelector('#ratingStars');
function starText(n){return '★'.repeat(n)+'☆'.repeat(5-n)}
async function loadReviews(){
 const {data,error}=await supabase.from('arc_reviews').select('id,user_name,avatar_url,rating,comment,created_at').eq('status','approved').order('created_at',{ascending:false}).limit(20);
 if(error){track.innerHTML='<div class="review-empty panel">Las reseñas reales quedarán disponibles al ejecutar el SQL v32.</div>';return}
 const rows=data||[];if(!rows.length){track.innerHTML='<div class="review-empty panel">Todavía no hay reseñas aprobadas.</div>';avg.textContent='—';stars.textContent='☆☆☆☆☆';return}
 const score=rows.reduce((a,r)=>a+Number(r.rating||0),0)/rows.length;avg.textContent=score.toFixed(1);stars.textContent=starText(Math.round(score));
 track.innerHTML=rows.map(r=>`<article class="review-card panel"><div class="stars">${starText(Number(r.rating||5))}</div><p>${esc(r.comment)}</p><footer>${r.avatar_url?`<img class="review-avatar" src="${esc(r.avatar_url)}" alt="">`:`<div class="review-avatar">${esc((r.user_name||'U')[0])}</div>`}<div><strong>${esc(r.user_name||'Usuario')}</strong><small>${new Date(r.created_at).toLocaleDateString('es')}</small></div></footer></article>`).join('')
}
document.querySelector('#reviewForm').addEventListener('submit',async e=>{e.preventDefault();const button=e.submitter,comment=document.querySelector('#reviewComment').value.trim(),rating=Number(document.querySelector('#reviewRating').value);if(!comment)return;button.disabled=true;button.textContent='Enviando…';const {data:{user}}=await supabase.auth.getUser();const name=user?.user_metadata?.full_name||user?.user_metadata?.name||user?.email?.split('@')[0]||'Usuario',avatar=user?.user_metadata?.avatar_url||user?.user_metadata?.picture||null;const {error}=await supabase.from('arc_reviews').insert({owner_id:user.id,user_name:name,avatar_url:avatar,rating,comment});button.disabled=false;button.textContent='Publicar reseña';if(error){alert(error.message);return}e.target.reset();alert('Reseña enviada para aprobación.');});
loadReviews();
