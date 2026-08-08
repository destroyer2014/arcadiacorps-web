import { supabase } from './auth.js?v=37';
import { mountShell } from './shell.js?v=40.1';

const access = await mountShell();
if (!access) throw new Error('Sin sesión');

const { user } = access;
const $ = selector => document.querySelector(selector);
const esc = (value='') => String(value).replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

const API = '/nero-api';
const STATUS_EVERY = 15000;

let records = [];
let active = null;
let refreshTimer = null;
let noticeTimer = null;
let loading = false;

function notice(text,ok=false) {
  const node = $('#subbotNotice');
  if (!node) return;
  clearTimeout(noticeTimer);
  node.textContent = text;
  node.className = `message show ${ok ? 'ok' : 'error'}`;
  noticeTimer = setTimeout(()=>node.className='message',4500);
}

function modal(id,on) {
  const node = $('#'+id);
  if (!node) return;
  node.classList.toggle('open',on);
  node.setAttribute('aria-hidden',String(!on));
}

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || '';
}

async function api(path,options={}) {
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(),45000);

  try {
    const response = await fetch(API+path,{
      ...options,
      headers:{
        Authorization:`Bearer ${await token()}`,
        ...(options.body ? {'Content-Type':'application/json'} : {}),
        ...(options.headers || {})
      },
      signal:controller.signal
    });

    const body = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(body.error || `Error ${response.status}`);
    return body;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('El servidor tardó demasiado en responder.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function statusLabel(status) {
  if (status === 'online') return 'Conectado';
  if (status === 'launching') return 'Iniciando';
  if (status === 'stopping') return 'Deteniendo';
  if (status === 'errored') return 'Error';
  if (status === 'pairing') return 'Vinculando';
  return 'Desconectado';
}

function ensureStatusBar() {
  if ($('#subbotStatusBar')) return;

  const hero = document.querySelector('.subbots-hero');
  if (!hero) return;

  const bar = document.createElement('section');
  bar.id = 'subbotStatusBar';
  bar.className = 'subbot-livebar';
  bar.innerHTML = `
    <div>
      <span class="subbot-live-dot"></span>
      <strong id="subbotLiveText">Estado en vivo</strong>
      <small id="subbotLastUpdate">Actualizando…</small>
    </div>
    <button id="refreshSubbots" class="secondary compact" type="button">↻ Actualizar</button>
  `;
  hero.insertAdjacentElement('afterend',bar);
  $('#refreshSubbots').addEventListener('click',()=>load(true));
}

async function load(showFeedback=false) {
  if (loading) return;
  loading = true;

  const refresh = $('#refreshSubbots');
  if (refresh) {
    refresh.disabled = true;
    refresh.textContent = 'Actualizando…';
  }

  try {
    const { data,error } = await supabase
      .from('arc_subbots')
      .select('*')
      .order('created_at',{ascending:false});

    if (error) throw error;

    records = data || [];
    let statuses = {};

    try {
      const result = await api('/subbots');
      statuses = Object.fromEntries(
        (result.items || []).map(item=>[String(item.phone),item])
      );
    } catch {}

    records = records.map(record=>({
      ...record,
      live:statuses[String(record.phone)] || null
    }));

    render();

    const online = records.filter(row=>row.live?.status === 'online').length;
    if ($('#subbotLiveText')) {
      $('#subbotLiveText').textContent =
        records.length ? `${online}/${records.length} conectados` : 'Sin Sub-Bots';
    }
    if ($('#subbotLastUpdate')) {
      $('#subbotLastUpdate').textContent =
        `Actualizado ${new Date().toLocaleTimeString('es-PE',{
          hour:'2-digit',minute:'2-digit',second:'2-digit'
        })}`;
    }

    if (showFeedback) notice('Estado actualizado.',true);
  } catch (error) {
    notice(error.message || 'No se pudieron cargar los Sub-Bots.');
  } finally {
    loading = false;
    if (refresh) {
      refresh.disabled = false;
      refresh.textContent = '↻ Actualizar';
    }
  }
}

function avatarHtml(record) {
  return record.avatar_url
    ? `<img src="${esc(record.avatar_url)}" alt="">`
    : `<div class="subbot-avatar">🤖</div>`;
}

async function copyText(text,button=null) {
  const value = String(text || '').trim();
  if (!value) return false;

  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
    } else {
      const area = document.createElement('textarea');
      area.value = value;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }

    if (button) {
      const old = button.textContent;
      button.textContent = '✓ Copiado';
      setTimeout(()=>button.textContent=old,1200);
    }
    return true;
  } catch {
    notice('No se pudo copiar automáticamente.');
    return false;
  }
}

function setBusy(button,busy,label='Procesando…') {
  if (!button) return;
  if (busy) {
    button.dataset.oldText = button.textContent;
    button.disabled = true;
    button.textContent = label;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.oldText || button.textContent;
  }
}

function render() {
  const list = $('#subbotList');
  const empty = $('#emptyState');
  if (!list || !empty) return;

  empty.hidden = records.length > 0;
  list.hidden = !records.length;
  list.innerHTML = '';

  for (const record of records) {
    const status = record.live?.status || record.connection_status || 'stopped';
    const online = status === 'online';
    const pid = record.live?.pid ? `PID ${record.live.pid}` : 'Sin proceso activo';

    const card = document.createElement('article');
    card.className = 'subbot-card subbot-card-v38';
    card.dataset.status = status;
    card.innerHTML = `
      <div class="subbot-card-head">
        ${avatarHtml(record)}
        <div class="subbot-card-copy">
          <h2>${esc(record.name)}</h2>
          <p>+${esc(record.phone)}</p>
          <div class="subbot-state-line">
            <span class="subbot-status ${esc(status)}">${statusLabel(status)}</span>
            <small>${esc(pid)}</small>
          </div>
        </div>
      </div>

      <div class="subbot-meta">
        <div>
          <small>ID</small>
          <strong>${esc(record.bot_id)}</strong>
          <button data-copy-id class="subbot-mini-copy" type="button">Copiar ID</button>
        </div>
        <div>
          <small>Prefijo</small>
          <strong>${esc(record.prefix)}</strong>
        </div>
      </div>

      <div class="subbot-actions subbot-actions-v38">
        <button data-edit class="secondary" type="button">Editar</button>
        <button data-pair class="primary" type="button">Vincular</button>
        <button data-action="${online ? 'stop' : 'start'}" class="secondary" type="button">
          ${online ? 'Detener' : 'Iniciar'}
        </button>
        <button data-action="restart" class="secondary" type="button">Reiniciar</button>
        <button data-delete class="danger" type="button">Eliminar</button>
      </div>
    `;

    card.querySelector('[data-copy-id]').onclick =
      event=>copyText(record.bot_id,event.currentTarget);
    card.querySelector('[data-edit]').onclick = ()=>openEdit(record);
    card.querySelector('[data-pair]').onclick = ()=>openPair(record);
    card.querySelectorAll('[data-action]').forEach(button=>{
      button.onclick = ()=>processAction(record,button.dataset.action,button);
    });
    card.querySelector('[data-delete]').onclick =
      event=>remove(record,event.currentTarget);

    list.appendChild(card);
  }
}

function openCreate() {
  if (records.length >= 1) return notice('Tu cuenta permite 1 Sub-Bot.');

  active = null;
  $('#subbotForm').reset();
  $('#recordId').value = '';
  $('#phone').disabled = false;
  $('#name').value = 'Nero Subbot';
  $('#prefix').value = '.';
  $('#avatarPreview').textContent = '🤖';
  $('#modalTitle').textContent = 'Nuevo Sub-Bot';
  modal('subbotModal',true);
}

function openEdit(record) {
  active = record;
  $('#recordId').value = record.id;
  $('#phone').value = record.phone;
  $('#phone').disabled = true;
  $('#name').value = record.name;
  $('#prefix').value = record.prefix;
  $('#statusText').value = record.status_text || '';
  $('#autoRead').checked = Boolean(record.auto_read);
  $('#avatarPreview').innerHTML = record.avatar_url
    ? `<img src="${esc(record.avatar_url)}" alt="">`
    : '🤖';
  $('#modalTitle').textContent = 'Editar Sub-Bot';
  modal('subbotModal',true);
}

$('#avatar').onchange = event=>{
  const file = event.target.files?.[0];
  if (!file) return;

  if (file.size > 2*1024*1024) {
    event.target.value = '';
    return notice('La imagen supera 2 MB.');
  }

  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
    event.target.value = '';
    return notice('Formato no permitido. Usa JPG, PNG o WEBP.');
  }

  $('#avatarPreview').innerHTML =
    `<img src="${URL.createObjectURL(file)}" alt="Vista previa">`;
};

$('#subbotForm').onsubmit = async event=>{
  event.preventDefault();

  const submit = event.currentTarget.querySelector('button[type=submit]');
  const phone = $('#phone').value.replace(/\D/g,'');
  const name = $('#name').value.trim();
  const prefix = $('#prefix').value.trim();

  if (!/^\d{8,15}$/.test(phone)) {
    return notice('Número inválido. Usa código de país y solo números.');
  }
  if (!name) return notice('Escribe un nombre.');
  if (!prefix || /\s/.test(prefix)) {
    return notice('El prefijo no puede contener espacios.');
  }

  const payload = {
    owner_id:user.id,
    phone,
    bot_id:`subbot-${phone}`,
    name,
    prefix,
    status_text:$('#statusText').value.trim() || null,
    auto_read:$('#autoRead').checked
  };

  setBusy(submit,true,'Guardando…');

  try {
    let row;
    if (active) {
      const { data,error } = await supabase
        .from('arc_subbots')
        .update(payload)
        .eq('id',active.id)
        .eq('owner_id',user.id)
        .select()
        .single();
      if (error) throw error;
      row = data;
    } else {
      const { data,error } = await supabase
        .from('arc_subbots')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      row = data;
    }

    const file = $('#avatar').files?.[0];
    if (file) {
      const ext = file.type === 'image/png' ? 'png' :
        file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${user.id}/${row.id}/avatar-${Date.now()}.${ext}`;

      const upload = await supabase.storage
        .from('subbot-avatars')
        .upload(path,file,{upsert:true,contentType:file.type});
      if (upload.error) throw upload.error;

      const publicUrl = supabase.storage
        .from('subbot-avatars')
        .getPublicUrl(path).data.publicUrl;

      const update = await supabase
        .from('arc_subbots')
        .update({avatar_url:publicUrl,avatar_path:path})
        .eq('id',row.id)
        .eq('owner_id',user.id);
      if (update.error) throw update.error;

      row.avatar_url = publicUrl;
    }

    await api(`/subbots/${row.id}/config`,{
      method:'PATCH',
      body:JSON.stringify({
        name:row.name,
        prefix:row.prefix,
        statusText:row.status_text,
        autoRead:row.auto_read,
        avatarUrl:row.avatar_url || null
      })
    }).catch(()=>{});

    modal('subbotModal',false);
    notice('Configuración guardada.',true);
    await load();
  } catch (error) {
    notice(error.message || 'No se pudo guardar.');
  } finally {
    setBusy(submit,false);
  }
};

function ensurePairCopy() {
  if ($('#copyPairCode')) return;

  const output = $('#pairCode');
  if (!output) return;

  output.tabIndex = 0;
  output.title = 'Toca para copiar el código';

  const button = document.createElement('button');
  button.id = 'copyPairCode';
  button.className = 'secondary pair-copy-v38';
  button.type = 'button';
  button.textContent = 'Copiar código';
  button.disabled = true;
  output.insertAdjacentElement('afterend',button);

  const copy = async()=>{
    const raw = output.dataset.rawCode || '';
    if (!raw) return;
    await copyText(raw,button);
  };

  output.addEventListener('click',copy);
  output.addEventListener('keydown',event=>{
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      copy();
    }
  });
  button.addEventListener('click',copy);
}

function openPair(record) {
  active = record;
  ensurePairCopy();

  $('#pairCode').textContent = '— — — — — — — —';
  $('#pairCode').dataset.rawCode = '';
  $('#copyPairCode').disabled = true;
  $('#generateCode').disabled = false;
  $('#generateCode').textContent = 'Generar código';

  modal('pairModal',true);
}

/*
 * IMPORTANTE v38.1:
 * Este flujo conserva el endpoint actual TAL CUAL.
 * No añade cooldown, no cambia tiempos y no altera cómo el backend genera el código.
 * Solo añade estados visuales y copia rápida.
 */
$('#generateCode').onclick = async()=>{
  if (!active) return;

  const button = $('#generateCode');
  const output = $('#pairCode');

  setBusy(button,true,'Generando…');
  output.textContent = 'Generando…';
  output.dataset.rawCode = '';
  $('#copyPairCode').disabled = true;

  try {
    const result = await api(`/subbots/${active.id}/pairing-code`,{method:'POST'});
    const raw = String(result.code || '').replace(/\s+/g,'').toUpperCase();

    if (!raw) throw new Error('El servidor no devolvió el código.');

    output.dataset.rawCode = raw;
    output.textContent = raw.match(/.{1,4}/g)?.join(' ') || raw;
    $('#copyPairCode').disabled = false;
    notice('Código generado correctamente.',true);
  } catch (error) {
    output.textContent = 'Error';
    notice(error.message || 'No se pudo generar el código.');
  } finally {
    setBusy(button,false);
  }
};

$('#generateQr').onclick = async()=>{
  try {
    $('#qrBox').textContent = 'Generando…';
    const result = await api(`/subbots/${active.id}/qr`,{method:'POST'});
    $('#qrBox').innerHTML = result.dataUrl
      ? `<img src="${esc(result.dataUrl)}" alt="QR">`
      : 'QR no disponible';
  } catch (error) {
    $('#qrBox').textContent = error.message || 'QR no disponible';
  }
};

document.querySelectorAll('[data-pair-tab]').forEach(button=>{
  button.onclick = ()=>{
    document.querySelectorAll('[data-pair-tab]').forEach(item=>{
      item.classList.toggle('active',item===button);
    });
    $('#pairCodePanel').hidden = button.dataset.pairTab !== 'code';
    $('#pairQrPanel').hidden = button.dataset.pairTab !== 'qr';
  };
});

async function processAction(record,action,button) {
  const labels = {
    start:'Iniciando…',
    stop:'Deteniendo…',
    restart:'Reiniciando…'
  };

  setBusy(button,true,labels[action] || 'Procesando…');

  try {
    await api(`/subbots/${record.id}/${action}`,{method:'POST'});
    notice(`Acción ${action} enviada.`,true);
    setTimeout(()=>load(),1100);
  } catch (error) {
    notice(error.message || 'La acción no pudo completarse.');
  } finally {
    setBusy(button,false);
  }
}

async function remove(record,button) {
  if (!confirm(`¿Eliminar ${record.name}? También se cerrará su sesión.`)) return;

  setBusy(button,true,'Eliminando…');

  try {
    await api(`/subbots/${record.id}`,{method:'DELETE'});
    const { error } = await supabase
      .from('arc_subbots')
      .delete()
      .eq('id',record.id)
      .eq('owner_id',user.id);

    if (error) throw error;

    notice('Sub-Bot eliminado.',true);
    await load();
  } catch (error) {
    notice(error.message || 'No se pudo eliminar.');
  } finally {
    setBusy(button,false);
  }
}

function startAutoRefresh() {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(()=>{
    if (document.visibilityState === 'visible') load();
  },STATUS_EVERY);
}

ensureStatusBar();
ensurePairCopy();

$('#newSubbot').onclick = openCreate;
$('#emptyCreate').onclick = openCreate;
$('#closeModal').onclick = $('#cancelModal').onclick = ()=>modal('subbotModal',false);
$('#closePair').onclick = ()=>modal('pairModal',false);

document.addEventListener('visibilitychange',()=>{
  if (document.visibilityState === 'visible') load();
});

window.addEventListener('pagehide',()=>clearInterval(refreshTimer),{once:true});

await load();
startAutoRefresh();
