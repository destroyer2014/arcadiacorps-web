import { supabase } from './auth.js';
import { mountShell } from './shell.js?v=36';

const access = await mountShell();
if (!access) throw new Error('Sin sesión');

const { user, profile, role } = access;
const $ = (selector) => document.querySelector(selector);
const feed = $('#feed');
const msg = $('#socialMessage');

const state = {
  posts: [],
  profiles: new Map(),
  liked: new Set(),
  stories: [],
  storyGroups: [],
  activeStoryGroup: 0,
  activeStoryItem: 0,
};

if (profile?.id) state.profiles.set(profile.id, profile);

const esc = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));

const currentUsername = () => profile?.username || profile?.full_name || user.user_metadata?.user_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario';
const nameOf = (p, fallback = '') => p?.username || p?.full_name || fallback || 'Usuario';
const postText = (post) => String(post?.body ?? post?.content ?? '');
const commentText = (comment) => String(comment?.body ?? comment?.content ?? '');
const avatarUrl = (p) => {
  const raw = p?.avatar_url || (p?.id === user.id ? (user.user_metadata?.avatar_url || user.user_metadata?.picture || '') : '');
  if (!raw) return '';
  if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
  return supabase.storage.from('avatars').getPublicUrl(String(raw).replace(/^\/+/, '')).data?.publicUrl || '';
};
const avatar = (p, cls = 'social-avatar') => {
  const url = avatarUrl(p);
  return url
    ? `<img class="${cls}" src="${esc(url)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=&quot;${cls} fallback&quot;>${esc(nameOf(p).slice(0, 1).toUpperCase())}</div>'">`
    : `<div class="${cls} fallback">${esc(nameOf(p).slice(0, 1).toUpperCase())}</div>`;
};
const badge = (r) => r === 'owner'
  ? '<span class="social-role owner">🛡 Owner</span>'
  : r === 'staff'
    ? '<span class="social-role staff">🛡 Adm</span>'
    : '';
const formatDate = (value) => new Intl.DateTimeFormat('es-PE', {
  day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
}).format(new Date(value));

function show(text, ok = false) {
  msg.textContent = text;
  msg.className = `message show ${ok ? 'ok' : 'error'}`;
  setTimeout(() => { msg.className = 'message'; }, 4500);
}

function open(id) {
  const element = document.getElementById(id);
  if (!element) return;
  element.classList.add('open');
  element.setAttribute('aria-hidden', 'false');
}

function close(id) {
  const element = document.getElementById(id);
  if (!element) return;
  element.classList.remove('open');
  element.setAttribute('aria-hidden', 'true');
}

document.querySelectorAll('[data-close]').forEach((button) => {
  button.onclick = () => close(button.dataset.close);
});

$('#openComposer').onclick = $('#quickSend').onclick = () => open('composerModal');
$('#openStory').onclick = () => open('storyModal');
$('#refreshSocial').onclick = loadAll;
$('#quickAvatar').outerHTML = avatar(profile, 'social-avatar');

async function upload(file, folder) {
  if (!file) return null;
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${user.id}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('social-media').upload(path, file, {
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  return path;
}

async function signed(path) {
  if (!path) return '';
  const { data, error } = await supabase.storage.from('social-media').createSignedUrl(path, 3600);
  if (error) return '';
  return data?.signedUrl || '';
}

async function loadProfiles(ids) {
  const missing = [...new Set(ids.filter(Boolean))].filter((id) => !state.profiles.has(id));
  if (!missing.length) return;
  const { data, error } = await supabase
    .from('profiles')
    .select('id,username,full_name,avatar_url,role')
    .in('id', missing);
  if (error) throw error;
  (data || []).forEach((p) => state.profiles.set(p.id, p));
}

async function loadStories() {
  const { data, error } = await supabase
    .from('social_stories')
    .select('*')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true });
  if (error) throw error;

  state.stories = data || [];
  await loadProfiles(state.stories.map((story) => story.user_id));

  const groups = new Map();
  for (const story of state.stories) {
    const key = story.user_id || `legacy-${story.username || story.id}`;
    if (!groups.has(key)) groups.set(key, { key, userId: story.user_id, items: [] });
    groups.get(key).items.push(story);
  }
  state.storyGroups = [...groups.values()].sort((a, b) => {
    const aDate = new Date(a.items.at(-1)?.created_at || 0);
    const bDate = new Date(b.items.at(-1)?.created_at || 0);
    return bDate - aDate;
  });

  renderStories();
}

function storyProfile(group) {
  return state.profiles.get(group.userId) || null;
}

function storyName(group) {
  const p = storyProfile(group);
  const fallback = group.items.at(-1)?.username || '';
  return nameOf(p, fallback);
}

function renderStories() {
  const strip = $('#storyStrip');
  strip.querySelectorAll('.story-item').forEach((item) => item.remove());

  state.storyGroups.forEach((group, groupIndex) => {
    const p = storyProfile(group);
    const button = document.createElement('button');
    button.className = 'story-item';
    button.type = 'button';
    button.innerHTML = `<span>${avatar(p, 'story-avatar')}<b>${group.items.length}</b></span><small>${esc(storyName(group))}</small>`;
    button.onclick = () => openStoryGroup(groupIndex, 0);
    strip.appendChild(button);
  });
}

async function openStoryGroup(groupIndex, itemIndex = 0) {
  state.activeStoryGroup = groupIndex;
  state.activeStoryItem = itemIndex;
  await renderStoryViewer();
  $('#storyViewer').classList.add('open');
}

async function renderStoryViewer() {
  const group = state.storyGroups[state.activeStoryGroup];
  if (!group?.items?.length) {
    $('#storyViewer').classList.remove('open');
    return;
  }

  if (state.activeStoryItem >= group.items.length) state.activeStoryItem = 0;
  if (state.activeStoryItem < 0) state.activeStoryItem = group.items.length - 1;

  const story = group.items[state.activeStoryItem];
  const p = storyProfile(group);
  const image = story.image_path ? await signed(story.image_path) : '';
  const canDelete = story.user_id === user.id || ['owner', 'staff'].includes(role);
  const content = $('#storyViewerContent');
  content.className = `story-view ${esc(story.background || 'blue-purple')}`;
  content.innerHTML = `
    <div class="story-progress">${group.items.map((_, index) => `<span class="${index <= state.activeStoryItem ? 'active' : ''}"></span>`).join('')}</div>
    <header>${avatar(p, 'story-avatar')}<strong>${esc(storyName(group))}</strong>${badge(p?.role)}<small>${formatDate(story.created_at)}</small></header>
    ${image ? `<img src="${esc(image)}" alt="Historia">` : ''}
    ${story.body ? `<p>${esc(story.body)}</p>` : ''}
    <button class="story-nav prev" type="button" aria-label="Historia anterior">‹</button>
    <button class="story-nav next" type="button" aria-label="Historia siguiente">›</button>
    ${canDelete ? '<button class="story-delete" type="button">🗑 Eliminar historia</button>' : ''}
  `;

  content.querySelector('.prev').onclick = async () => {
    state.activeStoryItem -= 1;
    await renderStoryViewer();
  };
  content.querySelector('.next').onclick = async () => {
    state.activeStoryItem += 1;
    await renderStoryViewer();
  };
  content.querySelector('.story-delete')?.addEventListener('click', () => deleteStory(story));
}

async function deleteStory(story) {
  if (!confirm('¿Eliminar esta historia?')) return;
  const { error } = await supabase.from('social_stories').delete().eq('id', story.id);
  if (error) return show(error.message);
  if (story.image_path) await supabase.storage.from('social-media').remove([story.image_path]);
  await loadStories();
  const group = state.storyGroups[state.activeStoryGroup];
  if (!group) {
    $('#storyViewer').classList.remove('open');
  } else {
    state.activeStoryItem = Math.min(state.activeStoryItem, group.items.length - 1);
    await renderStoryViewer();
  }
  show('Historia eliminada.', true);
}

$('#closeStoryViewer').onclick = () => $('#storyViewer').classList.remove('open');

async function loadPosts() {
  const { data, error } = await supabase
    .from('social_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;

  state.posts = data || [];
  await loadProfiles(state.posts.map((post) => post.user_id));
  const ids = state.posts.map((post) => post.id);
  let likes = [];
  let comments = [];

  if (ids.length) {
    const likeResult = await supabase.from('social_post_likes').select('post_id,user_id').in('post_id', ids);
    if (likeResult.error) throw likeResult.error;
    likes = likeResult.data || [];

    const commentResult = await supabase.from('social_comments').select('*').in('post_id', ids).order('created_at', { ascending: true });
    if (commentResult.error) throw commentResult.error;
    comments = commentResult.data || [];
    await loadProfiles(comments.map((comment) => comment.user_id));
  }

  state.liked = new Set(likes.filter((like) => like.user_id === user.id).map((like) => like.post_id));
  const counts = {};
  likes.forEach((like) => { counts[like.post_id] = (counts[like.post_id] || 0) + 1; });
  const byPost = {};
  comments.forEach((comment) => { (byPost[comment.post_id] ??= []).push(comment); });
  await renderPosts(counts, byPost);
}

async function renderPosts(counts, comments) {
  feed.innerHTML = '';
  const featured = $('#featuredPosts');
  featured.innerHTML = '';
  let featuredCount = 0;

  for (const post of state.posts) {
    const card = await postCard(post, counts[post.id] || 0, comments[post.id] || []);
    feed.appendChild(card);
    if (post.is_featured && featuredCount < 3) {
      const p = state.profiles.get(post.user_id);
      const mini = document.createElement('button');
      mini.className = 'featured-mini';
      mini.innerHTML = `<strong>${esc(nameOf(p, post.username))}</strong><span>${esc(postText(post).slice(0, 90))}</span>`;
      mini.onclick = () => card.scrollIntoView({ behavior: 'smooth' });
      featured.appendChild(mini);
      featuredCount += 1;
    }
  }

  if (!state.posts.length) feed.innerHTML = '<div class="panel social-empty">Todavía no hay publicaciones. Sé el primero.</div>';
  if (!featuredCount) featured.innerHTML = '<p class="social-empty">No hay publicaciones destacadas aún</p>';
}

async function postCard(post, likeCount, comments) {
  const p = state.profiles.get(post.user_id);
  const displayName = nameOf(p, post.username);
  const canManage = post.user_id === user.id || ['owner', 'staff'].includes(role);
  const image = post.image_path ? await signed(post.image_path) : '';
  const article = document.createElement('article');
  article.className = 'social-post panel';
  article.dataset.id = post.id;
  article.innerHTML = `
    <header>${avatar(p)}<div><strong>${esc(displayName)} ${badge(p?.role)}</strong><small>${formatDate(post.created_at)}</small></div>${canManage ? '<button class="post-menu" type="button">⋯</button>' : ''}</header>
    <div class="post-body">${esc(postText(post)).replace(/\n/g, '<br>')}</div>
    ${image ? `<img class="post-image" src="${esc(image)}" alt="Imagen de publicación">` : ''}
    <div class="post-actions"><button class="like ${state.liked.has(post.id) ? 'active' : ''}" type="button">♥ <span>${likeCount}</span></button><button class="comments-toggle" type="button">💬 <span>${comments.length}</span></button><button type="button" class="share">↗</button><button type="button" class="save">◌</button></div>
    <div class="comments-list">${comments.map((comment) => {
      const cp = state.profiles.get(comment.user_id);
      return `<div class="social-comment">${avatar(cp, 'comment-avatar')}<p><strong>${esc(nameOf(cp))} ${badge(cp?.role)}</strong> ${esc(commentText(comment))}<small>${formatDate(comment.created_at)}</small></p></div>`;
    }).join('')}</div>
    <form class="comment-form"><input maxlength="800" placeholder="Escribe un comentario…" required><button type="submit">➤</button></form>
    ${canManage ? `<div class="post-admin"><button data-act="feature" type="button">${post.is_featured ? 'Quitar destacada' : '⭐ Destacar'}</button><button data-act="delete" class="danger-btn" type="button">Eliminar</button></div>` : ''}
  `;

  article.querySelector('.like').onclick = () => toggleLike(post.id);
  article.querySelector('.comments-toggle').onclick = () => article.classList.toggle('comments-open');
  article.querySelector('.share').onclick = () => navigator.share?.({ title: 'ArcadiaCorps Social', url: location.href }) || navigator.clipboard.writeText(location.href);
  article.querySelector('.comment-form').onsubmit = (event) => addComment(event, post.id);
  article.querySelector('.post-menu')?.addEventListener('click', () => article.classList.toggle('admin-open'));
  article.querySelector('[data-act="delete"]')?.addEventListener('click', () => deletePost(post));
  article.querySelector('[data-act="feature"]')?.addEventListener('click', () => featurePost(post));
  return article;
}

async function toggleLike(id) {
  if (state.liked.has(id)) {
    const { error } = await supabase.from('social_post_likes').delete().eq('post_id', id).eq('user_id', user.id);
    if (error) return show(error.message);
  } else {
    const { error } = await supabase.from('social_post_likes').insert({ post_id: id, user_id: user.id });
    if (error) return show(error.message);
  }
  await loadPosts();
}

async function addComment(event, id) {
  event.preventDefault();
  const input = event.currentTarget.querySelector('input');
  const body = input.value.trim();
  if (!body) return;
  const username = currentUsername();
  const { error } = await supabase.from('social_comments').insert({
    post_id: id,
    user_id: user.id,
    username,
    content: body,
    body,
  });
  if (error) return show(error.message);
  input.value = '';
  await loadPosts();
}

async function deletePost(post) {
  if (!confirm('¿Eliminar esta publicación?')) return;
  const { error } = await supabase.from('social_posts').delete().eq('id', post.id);
  if (error) return show(error.message);
  if (post.image_path) await supabase.storage.from('social-media').remove([post.image_path]);
  await loadPosts();
}

async function featurePost(post) {
  const { error } = await supabase.from('social_posts').update({ is_featured: !post.is_featured }).eq('id', post.id);
  if (error) return show(error.message);
  await loadPosts();
}

$('#postImage').onchange = (event) => {
  const file = event.target.files[0];
  $('#postPreview').innerHTML = file ? `<img src="${URL.createObjectURL(file)}" alt="Vista previa">` : '';
};

$('#postForm').onsubmit = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type=submit]');
  button.disabled = true;
  try {
    const body = $('#postBody').value.trim();
    if (!body) throw new Error('Escribe algo para publicar.');
    const imagePath = await upload($('#postImage').files[0], 'posts');
    const username = currentUsername();
    const { error } = await supabase.from('social_posts').insert({
      user_id: user.id,
      username,
      content: body,
      body,
      image_path: imagePath,
    });
    if (error) throw error;
    form.reset();
    $('#postPreview').innerHTML = '';
    close('composerModal');
    show('Publicación creada.', true);
    await loadPosts();
  } catch (error) {
    show(error.message);
  } finally {
    button.disabled = false;
  }
};

function updateStoryCanvas() {
  const canvas = $('#storyCanvas');
  canvas.textContent = $('#storyText').value || 'Tu historia';
  canvas.className = `story-canvas ${$('#storyBackground').value}`;
}

$('#storyText').oninput = updateStoryCanvas;
$('#storyBackground').onchange = updateStoryCanvas;
$('#storyImage').onchange = (event) => {
  const count = event.target.files.length;
  const label = $('#storyFileCount');
  if (label) label.textContent = count ? `${count} imagen${count === 1 ? '' : 'es'} seleccionada${count === 1 ? '' : 's'}` : 'Puedes elegir varias imágenes';
};

$('#storyForm').onsubmit = async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type=submit]');
  button.disabled = true;
  try {
    const body = $('#storyText').value.trim();
    const background = $('#storyBackground').value;
    const files = [...$('#storyImage').files];
    if (!body && !files.length) throw new Error('Agrega texto o una imagen a la historia.');

    const username = currentUsername();
    const rows = [];
    if (files.length) {
      for (const file of files) {
        const imagePath = await upload(file, 'stories');
        rows.push({ user_id: user.id, username, body, background, image_path: imagePath });
      }
    } else {
      rows.push({ user_id: user.id, username, body, background, image_path: null });
    }

    const { error } = await supabase.from('social_stories').insert(rows);
    if (error) throw error;
    form.reset();
    updateStoryCanvas();
    const label = $('#storyFileCount');
    if (label) label.textContent = 'Puedes elegir varias imágenes';
    close('storyModal');
    show(`${rows.length > 1 ? `${rows.length} historias publicadas` : 'Historia publicada'} por 24 horas.`, true);
    await loadStories();
  } catch (error) {
    show(error.message);
  } finally {
    button.disabled = false;
  }
};

async function loadAll() {
  try {
    await Promise.all([loadStories(), loadPosts()]);
  } catch (error) {
    show(error.message);
    feed.innerHTML = `<div class="panel message show error">${esc(error.message)}</div>`;
  }
}

loadAll();
