import { supabase } from './auth.js';
import { mountShell } from './shell.js';

const access = await mountShell();
if (!access) throw new Error('Sin sesión');
const { user, profile, role } = access;
const $ = selector => document.querySelector(selector);
const esc = (value='') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const displayName = p => p?.full_name || p?.username || 'Usuario';
const roleBadge = r => r === 'owner' ? '<span class="chat-role owner">🛡 Owner</span>' : r === 'staff' ? '<span class="chat-role staff">🛡 Adm</span>' : '';
const time = value => new Intl.DateTimeFormat('es-PE',{hour:'numeric',minute:'2-digit'}).format(new Date(value));
const day = value => new Intl.DateTimeFormat('es-PE',{day:'numeric',month:'short'}).format(new Date(value));

const state = { conversations: [], profiles: new Map(), active: null, messages: [], blocked: false, channel: null, tab: 'conversations', search: '' };
const list = $('#conversationList'), peopleList = $('#peopleList'), room = $('#chatRoom'), empty = $('#chatEmpty');

function show(text, ok=false){ const el=$('#chatNotice'); el.textContent=text; el.className=`message show ${ok?'ok':'error'}`; setTimeout(()=>el.className='message',3500); }
function avatarMarkup(p, cls='chat-avatar'){ const name=displayName(p); return p?.avatar_url ? `<img class="${cls}" src="${esc(p.avatar_url)}" alt="">` : `<div class="${cls} fallback">${esc(name.slice(0,1).toUpperCase())}</div>`; }
function setAvatar(el,p){ el.outerHTML = avatarMarkup(p, el.className || 'chat-avatar'); }

async function loadProfiles(ids){
  const missing=[...new Set(ids.filter(Boolean))].filter(id=>!state.profiles.has(id));
  if(!missing.length) return;
  const {data,error}=await supabase.from('profiles').select('id,username,full_name,avatar_url,role').in('id',missing);
  if(error) throw error;
  (data||[]).forEach(p=>state.profiles.set(p.id,p));
}

async function loadConversations(){
  const {data,error}=await supabase.from('arc_chat_participants')
    .select('conversation_id,last_read_at,arc_chat_conversations(id,updated_at,created_at)')
    .eq('user_id',user.id).order('joined_at',{ascending:false});
  if(error) throw error;
  const ids=(data||[]).map(x=>x.conversation_id);
  if(!ids.length){ state.conversations=[]; renderConversations(); return; }
  const {data:parts,error:pe}=await supabase.from('arc_chat_participants').select('conversation_id,user_id').in('conversation_id',ids).neq('user_id',user.id);
  if(pe) throw pe;
  await loadProfiles((parts||[]).map(x=>x.user_id));
  const {data:last,error:le}=await supabase.from('arc_chat_messages').select('id,conversation_id,sender_id,body,image_path,created_at,deleted_at').in('conversation_id',ids).order('created_at',{ascending:false});
  if(le) throw le;
  const lastBy=new Map(); (last||[]).forEach(m=>{if(!lastBy.has(m.conversation_id))lastBy.set(m.conversation_id,m)});
  const partMap=new Map((parts||[]).map(x=>[x.conversation_id,x.user_id]));
  state.conversations=(data||[]).map(x=>({id:x.conversation_id,otherId:partMap.get(x.conversation_id),lastRead:x.last_read_at,updated:x.arc_chat_conversations?.updated_at,last:lastBy.get(x.conversation_id)})).sort((a,b)=>new Date(b.last?.created_at||b.updated)-new Date(a.last?.created_at||a.updated));
  renderConversations();
}

function renderConversations(){
  const q=state.search.toLowerCase();
  const rows=state.conversations.filter(c=>displayName(state.profiles.get(c.otherId)).toLowerCase().includes(q));
  list.innerHTML=rows.length?'':'<div class="chat-list-empty">No hay conversaciones todavía.</div>';
  let unreadTotal=0;
  rows.forEach(c=>{
    const p=state.profiles.get(c.otherId), last=c.last, unread=last && last.sender_id!==user.id && (!c.lastRead || new Date(last.created_at)>new Date(c.lastRead));
    if(unread) unreadTotal++;
    const b=document.createElement('button'); b.className=`chat-list-item ${state.active?.id===c.id?'active':''}`; b.type='button';
    b.innerHTML=`${avatarMarkup(p)}<div class="chat-list-copy"><div><strong>${esc(displayName(p))}</strong>${roleBadge(p?.role)}<time>${last?time(last.created_at):day(c.updated)}</time></div><p>${last?.deleted_at?'Mensaje eliminado':last?.body?esc(last.body):last?.image_path?'📷 Imagen':'Inicia la conversación'}</p></div>${unread?'<span class="unread-dot">1</span>':''}`;
    b.onclick=()=>openConversation(c); list.appendChild(b);
  });
  $('#unreadTotal').textContent=unreadTotal;
}

async function loadPeople(target=peopleList, query=''){
  const {data,error}=await supabase.from('profiles').select('id,username,full_name,avatar_url,role').neq('id',user.id).order('username').limit(100);
  if(error) throw error;
  (data||[]).forEach(p=>state.profiles.set(p.id,p));
  const q=query.trim().toLowerCase(); const users=(data||[]).filter(p=>displayName(p).toLowerCase().includes(q)||(p.username||'').toLowerCase().includes(q));
  target.innerHTML=users.length?'':'<div class="chat-list-empty">No se encontraron usuarios.</div>';
  users.forEach(p=>{const b=document.createElement('button');b.className='chat-list-item person';b.type='button';b.innerHTML=`${avatarMarkup(p)}<div class="chat-list-copy"><div><strong>${esc(displayName(p))}</strong>${roleBadge(p.role)}</div><p>@${esc(p.username||'usuario')}</p></div><span class="start-chat">Mensaje</span>`;b.onclick=()=>startConversation(p.id);target.appendChild(b)});
}

async function startConversation(otherId){
  try{
    const {data,error}=await supabase.rpc('arc_get_or_create_chat',{other_user:otherId});
    if(error) throw error;
    closeNewChat(); await loadConversations();
    const c=state.conversations.find(x=>x.id===data) || {id:data,otherId};
    await openConversation(c);
  }catch(e){alert(e.message)}
}

async function openConversation(c){
  state.active=c; document.body.classList.add('chat-room-open'); empty.hidden=true; room.hidden=false;
  const p=state.profiles.get(c.otherId); $('#roomName').textContent=displayName(p); $('#roomRole').innerHTML=roleBadge(p?.role); $('#roomStatus').textContent='Disponible';
  const old=$('#roomAvatar'); old.outerHTML=avatarMarkup(p,'chat-avatar');
  await checkBlock(); await loadMessages(); await markRead(); subscribe(); renderConversations();
}

async function loadMessages(){
  const {data,error}=await supabase.from('arc_chat_messages').select('*').eq('conversation_id',state.active.id).order('created_at',{ascending:true}).limit(300);
  if(error) return show(error.message);
  state.messages=data||[]; await loadProfiles(state.messages.map(x=>x.sender_id)); renderMessages();
}

async function signed(path){if(!path)return'';const {data}=await supabase.storage.from('chat-media').createSignedUrl(path,3600);return data?.signedUrl||''}
async function renderMessages(){
  const wrap=$('#messageList'); wrap.innerHTML='';
  if(!state.messages.length) wrap.innerHTML='<div class="messages-empty">Envía el primer mensaje ✨</div>';
  for(const m of state.messages){
    const mine=m.sender_id===user.id, row=document.createElement('div'); row.className=`message-row ${mine?'mine':'theirs'}`;
    let image=''; if(m.image_path&&!m.deleted_at) image=await signed(m.image_path);
    row.innerHTML=`<div class="message-bubble">${m.deleted_at?'<em>Mensaje eliminado</em>':`${m.body?`<p>${esc(m.body).replace(/\n/g,'<br>')}</p>`:''}${image?`<img src="${esc(image)}" alt="Imagen enviada">`:''}`}<footer><time>${time(m.created_at)}</time>${mine&&!m.deleted_at?`<button data-delete="${m.id}" type="button" title="Eliminar">⌫</button>`:''}</footer></div>`;
    row.querySelector('[data-delete]')?.addEventListener('click',()=>deleteMessage(m)); wrap.appendChild(row);
  }
  wrap.scrollTop=wrap.scrollHeight;
}

async function uploadImage(file){ if(!file)return null; const ext=(file.name.split('.').pop()||'jpg').toLowerCase(); const path=`${user.id}/${state.active.id}/${crypto.randomUUID()}.${ext}`; const {error}=await supabase.storage.from('chat-media').upload(path,file,{contentType:file.type,upsert:false}); if(error)throw error; return path; }

$('#messageForm').onsubmit=async e=>{
  e.preventDefault(); if(!state.active||state.blocked)return;
  const body=$('#messageBody').value.trim(), file=$('#messageImage').files[0]; if(!body&&!file)return;
  const btn=$('#sendMessage');btn.disabled=true;
  try{const image_path=await uploadImage(file);const {error}=await supabase.from('arc_chat_messages').insert({conversation_id:state.active.id,sender_id:user.id,body,image_path});if(error)throw error;$('#messageBody').value='';$('#messageImage').value='';$('#messagePreview').innerHTML='';await supabase.from('arc_chat_conversations').update({updated_at:new Date().toISOString()}).eq('id',state.active.id);await loadMessages();await loadConversations();}catch(err){show(err.message)}finally{btn.disabled=false}
};
$('#messageBody').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#messageForm').requestSubmit()}});
$('#messageImage').onchange=e=>{const f=e.target.files[0];$('#messagePreview').innerHTML=f?`<img src="${URL.createObjectURL(f)}" alt="Vista previa"><button type="button">×</button>`:'';$('#messagePreview button')?.addEventListener('click',()=>{$('#messageImage').value='';$('#messagePreview').innerHTML=''})};

async function deleteMessage(m){if(!confirm('¿Eliminar este mensaje?'))return;const {error}=await supabase.from('arc_chat_messages').update({deleted_at:new Date().toISOString(),body:null,image_path:null}).eq('id',m.id).eq('sender_id',user.id);if(error)return show(error.message);loadMessages()}
async function markRead(){await supabase.from('arc_chat_participants').update({last_read_at:new Date().toISOString()}).eq('conversation_id',state.active.id).eq('user_id',user.id)}

function subscribe(){ if(state.channel)supabase.removeChannel(state.channel); state.channel=supabase.channel(`chat-${state.active.id}`).on('postgres_changes',{event:'*',schema:'public',table:'arc_chat_messages',filter:`conversation_id=eq.${state.active.id}`},async()=>{await loadMessages();await markRead();await loadConversations()}).subscribe(); }

async function checkBlock(){const other=state.active.otherId;const {data}=await supabase.from('arc_chat_blocks').select('blocker_id,blocked_id').or(`and(blocker_id.eq.${user.id},blocked_id.eq.${other}),and(blocker_id.eq.${other},blocked_id.eq.${user.id})`);const mine=(data||[]).some(x=>x.blocker_id===user.id);state.blocked=(data||[]).length>0;$('#blockBtn').textContent=mine?'Desbloquear':'Bloquear';$('#messageForm').classList.toggle('disabled',state.blocked);$('#messageBody').placeholder=state.blocked?'No puedes enviar mensajes en esta conversación':'Escribe un mensaje…';}
$('#blockBtn').onclick=async()=>{if(!state.active)return;const other=state.active.otherId;const {data}=await supabase.from('arc_chat_blocks').select('id').eq('blocker_id',user.id).eq('blocked_id',other).maybeSingle();if(data){await supabase.from('arc_chat_blocks').delete().eq('id',data.id)}else if(confirm('¿Bloquear a este usuario?')){await supabase.from('arc_chat_blocks').insert({blocker_id:user.id,blocked_id:other})}await checkBlock()};

function openNewChat(){const m=$('#newChatModal');m.classList.add('open');m.setAttribute('aria-hidden','false');loadPeople($('#newChatPeople'),$('#newChatSearch').value)}
function closeNewChat(){const m=$('#newChatModal');m.classList.remove('open');m.setAttribute('aria-hidden','true')}
$('#newChatBtn').onclick=$('#emptyNewChat').onclick=openNewChat;$('#closeNewChat').onclick=closeNewChat;$('#newChatSearch').oninput=e=>loadPeople($('#newChatPeople'),e.target.value);
$('#chatSearch').oninput=e=>{state.search=e.target.value;state.tab==='conversations'?renderConversations():loadPeople(peopleList,state.search)};
document.querySelectorAll('.chat-tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.chat-tabs button').forEach(x=>x.classList.toggle('active',x===b));state.tab=b.dataset.tab;list.hidden=state.tab!=='conversations';peopleList.hidden=state.tab!=='people';if(state.tab==='people')loadPeople(peopleList,state.search)});
$('#chatBack').onclick=()=>{document.body.classList.remove('chat-room-open');room.hidden=true;empty.hidden=false};

try{await Promise.all([loadConversations(),loadPeople(peopleList)])}catch(e){list.innerHTML=`<div class="message show error">${esc(e.message)}</div>`}
