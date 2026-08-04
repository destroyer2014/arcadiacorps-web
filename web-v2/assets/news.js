import { supabase } from './auth.js';

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

export function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function slugify(value = '') {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || `noticia-${Date.now()}`;
}

export async function listPublishedNews() {
  const { data, error } = await supabase
    .from('news_posts')
    .select('id,title,slug,excerpt,content,cover_url,external_url,is_pinned,published_at,created_at,author_id,profiles!news_posts_author_id_fkey(username,full_name,avatar_url,role)')
    .eq('status', 'published')
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data || [];
}

export async function getNewsPost(idOrSlug) {
  let query = supabase
    .from('news_posts')
    .select('*,profiles!news_posts_author_id_fkey(username,full_name,avatar_url,role)');
  query = /^[0-9a-f-]{36}$/i.test(idOrSlug) ? query.eq('id', idOrSlug) : query.eq('slug', idOrSlug);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

export async function getComments(postId) {
  const { data, error } = await supabase
    .from('news_comments')
    .select('id,content,created_at,user_id,profiles!news_comments_user_id_fkey(username,full_name,avatar_url,role)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addComment(postId, content) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Debes iniciar sesión para comentar.');
  const clean = String(content || '').trim();
  if (clean.length < 2 || clean.length > 1000) throw new Error('El comentario debe tener entre 2 y 1000 caracteres.');
  const { error } = await supabase.from('news_comments').insert({ post_id: postId, user_id: user.id, content: clean });
  if (error) throw error;
}

export async function deleteComment(commentId) {
  const { error } = await supabase.from('news_comments').delete().eq('id', commentId);
  if (error) throw error;
}

export async function uploadNewsCover(file, userId) {
  if (!file) return null;
  if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) throw new Error('Formato no permitido. Usa JPG, PNG, WEBP o GIF.');
  if (file.size > 5 * 1024 * 1024) throw new Error('La imagen no puede superar 5 MB.');
  const ext = (file.name.split('.').pop() || 'webp').toLowerCase();
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('news-images').upload(path, file, { upsert: false, cacheControl: '3600' });
  if (error) throw error;
  return supabase.storage.from('news-images').getPublicUrl(path).data.publicUrl;
}

export async function saveNewsPost(payload, id = null) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Sesión no disponible.');
  const row = {
    title: payload.title.trim(),
    slug: payload.slug || slugify(payload.title),
    excerpt: payload.excerpt.trim(),
    content: payload.content.trim(),
    cover_url: payload.cover_url || null,
    external_url: payload.external_url || null,
    is_pinned: Boolean(payload.is_pinned),
    status: payload.status || 'published',
    published_at: payload.status === 'published' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  };
  if (!row.title || row.title.length > 160) throw new Error('El título es obligatorio y debe tener máximo 160 caracteres.');
  if (!row.content || row.content.length < 20) throw new Error('El contenido debe tener al menos 20 caracteres.');
  if (id) {
    const { data, error } = await supabase.from('news_posts').update(row).eq('id', id).select('id,slug').single();
    if (error) throw error;
    return data;
  }
  row.author_id = user.id;
  const { data, error } = await supabase.from('news_posts').insert(row).select('id,slug').single();
  if (error) throw error;
  return data;
}

export async function deleteNewsPost(id) {
  const { error } = await supabase.from('news_posts').delete().eq('id', id);
  if (error) throw error;
}
