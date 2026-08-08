import { supabase } from './auth.js?v=37';
import { mountShell } from './shell.js?v=40.1';

const access = await mountShell();
if (!access) throw new Error('No hay sesión');

const $ = selector => document.querySelector(selector);
const MAX_IMAGE = 8*1024*1024;
const ALLOWED_IMAGES = new Set(['image/jpeg','image/png','image/webp']);

const histories = {
  chatgpt:readHistory('chatgpt'),
  claude:readHistory('claude')
};
const lastAnswers = { chatgpt:'',claude:'' };
const objectUrls = new Set();
const activeRequests = new Map();

function readHistory(model) {
  try {
    const rows = JSON.parse(localStorage.getItem(`arcadia-ai-${model}`) || '[]');
    return Array.isArray(rows) ? rows.slice(-30) : [];
  } catch {
    return [];
  }
}

function saveHistory(model) {
  try {
    localStorage.setItem(
      `arcadia-ai-${model}`,
      JSON.stringify(histories[model].slice(-30))
    );
  } catch {}
}

async function token() {
  const { data:{ session } } = await supabase.auth.getSession();
  return session?.access_token || '';
}

async function copyText(value) {
  const text = String(value || '');
  if (!text) return false;

  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  return ok;
}

function messageHost(model) {
  return model === 'chatgpt' ? $('#gptMessages') : $('#claudeMessages');
}

function appendCode(parent,language,code) {
  const wrap = document.createElement('pre');
  wrap.className = 'ai-code-block';

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'ai-code-copy';
  copy.textContent = language ? `Copiar ${language}` : 'Copiar';

  const codeNode = document.createElement('code');
  codeNode.textContent = code;

  copy.addEventListener('click',async()=>{
    try {
      await copyText(code);
      const old = copy.textContent;
      copy.textContent = '✓ Copiado';
      setTimeout(()=>copy.textContent=old,1200);
    } catch {}
  });

  wrap.append(copy,codeNode);
  parent.appendChild(wrap);
}

function renderRichText(parent,text) {
  const source = String(text || '');
  const regex = /```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g;
  let cursor = 0;
  let match;

  while ((match = regex.exec(source))) {
    const before = source.slice(cursor,match.index);
    if (before.trim()) {
      const p = document.createElement('p');
      p.textContent = before.trim();
      parent.appendChild(p);
    }

    appendCode(parent,match[1],match[2].trim());
    cursor = regex.lastIndex;
  }

  const rest = source.slice(cursor);
  if (rest.trim() || !parent.childNodes.length) {
    const p = document.createElement('p');
    p.textContent = rest.trim() || source;
    parent.appendChild(p);
  }
}

function addMessage(model,role,text,persist=true) {
  const host = messageHost(model);
  const node = document.createElement('div');
  node.className = `ai-message ${role}`;

  if (role === 'assistant') renderRichText(node,text);
  else node.textContent = text;

  host.appendChild(node);
  host.scrollTop = host.scrollHeight;

  if (persist && ['user','assistant'].includes(role)) {
    histories[model].push({ role,content:text });
    histories[model] = histories[model].slice(-30);
    saveHistory(model);
  }

  if (role === 'assistant') lastAnswers[model] = text;
  return node;
}

function renderHistory(model) {
  const host = messageHost(model);
  host.innerHTML = '';

  if (!histories[model].length) {
    addMessage(
      model,
      'assistant',
      model === 'chatgpt'
        ? 'Hola. Soy ChatGPT dentro de ArcadiaCorps. Puedo ayudarte con la web, Nero Bot, Sub-Bots y soporte general.'
        : 'Hola. Soy Claude dentro de ArcadiaCorps. Puedo ayudarte con programación, Baileys, bots y automatización.',
      false
    );
    return;
  }

  histories[model].forEach(row=>addMessage(model,row.role,row.content,false));
  lastAnswers[model] =
    [...histories[model]].reverse().find(row=>row.role==='assistant')?.content || '';
}

function friendlyNetworkError(error) {
  if (error?.name === 'AbortError') return 'Solicitud cancelada.';
  if (/Failed to fetch/i.test(error?.message || '')) {
    return 'No se pudo conectar con el servidor de IA.';
  }
  return error?.message || 'La IA no respondió.';
}

function ensureStopButton(form,model) {
  let stop = form.querySelector('[data-stop-ai]');
  if (stop) return stop;

  stop = document.createElement('button');
  stop.type = 'button';
  stop.className = 'secondary ai-stop-v38';
  stop.dataset.stopAi = model;
  stop.textContent = 'Detener';
  stop.hidden = true;

  form.querySelector('button[type=submit]').insertAdjacentElement('beforebegin',stop);

  stop.addEventListener('click',()=>{
    activeRequests.get(model)?.abort();
  });

  return stop;
}

async function sendChat(model,message,submitButton,stopButton) {
  addMessage(model,'user',message);

  submitButton.disabled = true;
  stopButton.hidden = false;

  const controller = new AbortController();
  activeRequests.set(model,controller);

  const typing = document.createElement('div');
  typing.className = 'ai-message assistant';
  typing.innerHTML = '<span class="ai-loading"><i></i><i></i><i></i></span>';
  messageHost(model).appendChild(typing);
  messageHost(model).scrollTop = messageHost(model).scrollHeight;

  const timeout = setTimeout(()=>controller.abort(),65000);

  try {
    const response = await fetch(
      `/ai-api/${model === 'chatgpt' ? 'chat' : 'claude'}`,
      {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          Authorization:`Bearer ${await token()}`
        },
        body:JSON.stringify({
          message,
          history:histories[model].slice(-8)
        }),
        signal:controller.signal
      }
    );

    const data = await response.json().catch(()=>({}));
    typing.remove();

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'La IA no respondió.');
    }

    addMessage(model,'assistant',String(data.answer || 'Sin respuesta.'));
  } catch (error) {
    typing.remove();
    addMessage(model,'error',friendlyNetworkError(error),false);
  } finally {
    clearTimeout(timeout);
    activeRequests.delete(model);
    submitButton.disabled = false;
    stopButton.hidden = true;
  }
}

document.querySelectorAll('form[data-chat-model]').forEach(form=>{
  const model = form.dataset.chatModel;
  const textarea = form.querySelector('textarea');
  const submit = form.querySelector('button[type=submit]');
  const stop = ensureStopButton(form,model);

  textarea.addEventListener('input',()=>{
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight,145)}px`;
  });

  textarea.addEventListener('keydown',event=>{
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener('submit',event=>{
    event.preventDefault();
    const value = textarea.value.trim();
    if (!value || submit.disabled) return;

    textarea.value = '';
    textarea.style.height = 'auto';
    sendChat(model,value,submit,stop);
  });
});

document.querySelectorAll('[data-clear-chat]').forEach(button=>{
  button.addEventListener('click',()=>{
    const model = button.dataset.clearChat;
    if (!confirm('¿Borrar el historial de esta conversación en este dispositivo?')) return;

    histories[model] = [];
    lastAnswers[model] = '';
    saveHistory(model);
    renderHistory(model);
  });
});

document.querySelectorAll('[data-copy-last]').forEach(button=>{
  button.addEventListener('click',async()=>{
    const answer = lastAnswers[button.dataset.copyLast];
    if (!answer) return;

    try {
      await copyText(answer);
      const old = button.textContent;
      button.textContent = '✓ Respuesta copiada';
      setTimeout(()=>button.textContent=old,1200);
    } catch {}
  });
});

renderHistory('chatgpt');
renderHistory('claude');

function activateTool(name,updateHash=true) {
  const valid = ['chatgpt','claude','image-prompt','nano-banana'];
  const target = valid.includes(name) ? name : 'chatgpt';

  document.querySelectorAll('[data-ai-tool]').forEach(button=>{
    button.classList.toggle('active',button.dataset.aiTool===target);
  });

  document.querySelectorAll('[data-ai-panel]').forEach(panel=>{
    panel.classList.toggle('active',panel.dataset.aiPanel===target);
  });

  if (updateHash) history.replaceState(null,'',`#${target}`);
}

document.querySelectorAll('[data-ai-tool]').forEach(button=>{
  button.addEventListener('click',()=>activateTool(button.dataset.aiTool));
});

activateTool(location.hash.slice(1),false);
window.addEventListener('hashchange',()=>activateTool(location.hash.slice(1),false));

function validateFile(file) {
  if (!file) return;
  if (!ALLOWED_IMAGES.has(file.type)) {
    throw new Error('Usa una imagen JPG, PNG o WEBP.');
  }
  if (file.size > MAX_IMAGE) {
    throw new Error('La imagen supera el límite de 8 MB.');
  }
}

function configureImageForm(form) {
  const methodInput = form.querySelector('input[name=method]');
  const fileInput = form.querySelector('input[type=file]');
  const urlInput = form.querySelector('input[name=url]');
  const localField = form.querySelector('[data-local-field]');
  const urlField = form.querySelector('[data-url-field]');
  const preview = form.querySelector('.ai-preview');

  form.querySelectorAll('[data-method]').forEach(button=>{
    button.addEventListener('click',()=>{
      const method = button.dataset.method;
      methodInput.value = method;

      form.querySelectorAll('[data-method]').forEach(item=>{
        item.classList.toggle('active',item===button);
      });

      localField.hidden = method !== 'local';
      urlField.hidden = method !== 'url';
      fileInput.required = method === 'local';
      urlInput.required = method === 'url';

      if (method === 'url') fileInput.value = '';
      if (method === 'local') urlInput.value = '';
    });
  });

  fileInput.addEventListener('change',()=>{
    const file = fileInput.files?.[0];
    if (!file) return;

    try {
      validateFile(file);
      const url = URL.createObjectURL(file);
      objectUrls.add(url);
      preview.innerHTML = `<img src="${url}" alt="Vista previa">`;
    } catch (error) {
      fileInput.value = '';
      preview.innerHTML = `<div class="ai-preview-empty">${error.message}</div>`;
    }
  });

  urlInput.addEventListener('change',()=>{
    const value = urlInput.value.trim();
    if (!value) return;

    try {
      const parsed = new URL(value);
      if (!['http:','https:'].includes(parsed.protocol)) throw new Error();
      preview.innerHTML = `<img src="${value.replace(/"/g,'&quot;')}" alt="Vista previa">`;
    } catch {
      preview.innerHTML = '<div class="ai-preview-empty">URL de imagen no válida.</div>';
    }
  });
}

const imagePromptForm = $('#imagePromptForm');
const nanoForm = $('#nanoForm');

configureImageForm(imagePromptForm);
configureImageForm(nanoForm);

imagePromptForm.querySelector('[data-copy-result]').addEventListener('click',async event=>{
  const result = imagePromptForm.querySelector('[data-result]');
  const text = result.dataset.prompt || '';

  if (!text) return;

  await copyText(text);
  const old = event.currentTarget.textContent;
  event.currentTarget.textContent = '✓ Prompt copiado';
  setTimeout(()=>event.currentTarget.textContent=old,1200);
});

imagePromptForm.addEventListener('submit',async event=>{
  event.preventDefault();

  const button = imagePromptForm.querySelector('button[type=submit]');
  const result = imagePromptForm.querySelector('[data-result]');
  const formData = new FormData(imagePromptForm);
  const file = imagePromptForm.querySelector('input[type=file]').files?.[0];

  try {
    if (formData.get('method') === 'local') validateFile(file);
  } catch (error) {
    result.textContent = error.message;
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(),100000);

  button.disabled = true;
  button.textContent = 'Analizando…';
  result.dataset.prompt = '';
  result.innerHTML = '<span class="ai-loading"><i></i><i></i><i></i></span>';

  try {
    const response = await fetch('/ai-api/image-to-prompt',{
      method:'POST',
      headers:{ Authorization:`Bearer ${await token()}` },
      body:formData,
      signal:controller.signal
    });

    const data = await response.json().catch(()=>({}));

    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'No se pudo analizar la imagen.');
    }

    result.dataset.prompt = String(data.prompt || '');
    result.textContent = result.dataset.prompt || 'La API no devolvió un prompt.';
  } catch (error) {
    result.textContent = friendlyNetworkError(error);
  } finally {
    clearTimeout(timeout);
    button.disabled = false;
    button.textContent = 'Analizar imagen';
  }
});

nanoForm.addEventListener('submit',async event=>{
  event.preventDefault();

  const button = nanoForm.querySelector('button[type=submit]');
  const output = nanoForm.querySelector('[data-output]');
  const save = nanoForm.querySelector('[data-save-image]');
  const formData = new FormData(nanoForm);
  const file = nanoForm.querySelector('input[type=file]').files?.[0];

  try {
    if (formData.get('method') === 'local') validateFile(file);
  } catch (error) {
    output.innerHTML = `<div class="ai-preview-empty">${error.message}</div>`;
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(),125000);

  button.disabled = true;
  button.textContent = 'Generando…';
  output.innerHTML = '<span class="ai-loading"><i></i><i></i><i></i></span>';
  save.hidden = true;

  try {
    const response = await fetch('/ai-api/nanobanana',{
      method:'POST',
      headers:{ Authorization:`Bearer ${await token()}` },
      body:formData,
      signal:controller.signal
    });

    if (!response.ok) {
      const data = await response.json().catch(()=>({}));
      throw new Error(data.error || 'No se pudo editar la imagen.');
    }

    const blob = await response.blob();

    if (!blob.type.startsWith('image/')) {
      throw new Error('La API no devolvió una imagen válida.');
    }

    const url = URL.createObjectURL(blob);
    objectUrls.add(url);

    output.innerHTML = '';
    const image = document.createElement('img');
    image.src = url;
    image.alt = 'Imagen editada';
    output.appendChild(image);

    save.href = url;
    save.download =
      `arcadia-nano-${Date.now()}.${blob.type.includes('jpeg') ? 'jpg' : 'png'}`;
    save.hidden = false;
  } catch (error) {
    output.innerHTML = '';
    const text = document.createElement('div');
    text.className = 'ai-preview-empty';
    text.textContent = friendlyNetworkError(error);
    output.appendChild(text);
  } finally {
    clearTimeout(timeout);
    button.disabled = false;
    button.textContent = 'Generar edición';
  }
});

window.addEventListener('pagehide',()=>{
  for (const controller of activeRequests.values()) controller.abort();
  objectUrls.forEach(url=>URL.revokeObjectURL(url));
},{ once:true });
