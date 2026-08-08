import { supabase } from './auth.js';
import { mountShell } from './shell.js?v=40.1';

const access = await mountShell();
if (!access) throw new Error('No hay sesión');

const $ = selector => document.querySelector(selector);
function readHistory(model) {
  try {
    const value = JSON.parse(localStorage.getItem(`arcadia-ai-${model}`) || '[]');
    return Array.isArray(value) ? value.slice(-30) : [];
  } catch {
    return [];
  }
}
const histories = {
  chatgpt:readHistory('chatgpt'),
  claude:readHistory('claude')
};
const lastAnswers = { chatgpt:'',claude:'' };
const objectUrls = new Set();

function saveHistory(model) {
  localStorage.setItem(`arcadia-ai-${model}`,JSON.stringify(histories[model].slice(-30)));
}

async function token() {
  const { data:{ session } } = await supabase.auth.getSession();
  return session?.access_token || '';
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
  copy.addEventListener('click',async () => {
    await navigator.clipboard.writeText(code);
    copy.textContent = 'Copiado';
    setTimeout(()=>copy.textContent=language ? `Copiar ${language}` : 'Copiar',1200);
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
    const before = source.slice(cursor,match.index).trim();
    if (before) {
      const p = document.createElement('p');
      p.textContent = before;
      parent.appendChild(p);
    }
    appendCode(parent,match[1],match[2].trim());
    cursor = regex.lastIndex;
  }
  const rest = source.slice(cursor).trim();
  if (rest || !parent.childNodes.length) {
    const p = document.createElement('p');
    p.textContent = rest || source;
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
    const intro = model === 'chatgpt'
      ? 'Hola. Soy ChatGPT dentro de ArcadiaCorps. Puedo ayudarte con la web, Nero Bot, Sub-Bots y soporte general.'
      : 'Hola. Soy Claude dentro de ArcadiaCorps. Puedo ayudarte con programación, Baileys, bots y automatización.';
    addMessage(model,'assistant',intro,false);
    return;
  }
  histories[model].forEach(row => addMessage(model,row.role,row.content,false));
  const latest = [...histories[model]].reverse().find(row=>row.role==='assistant');
  lastAnswers[model] = latest?.content || '';
}

async function sendChat(model,message,button) {
  addMessage(model,'user',message);
  button.disabled = true;
  const typing = document.createElement('div');
  typing.className = 'ai-message assistant';
  typing.innerHTML = '<span class="ai-loading"><i></i><i></i><i></i></span>';
  messageHost(model).appendChild(typing);
  messageHost(model).scrollTop = messageHost(model).scrollHeight;

  try {
    const response = await fetch(`/ai-api/${model === 'chatgpt' ? 'chat' : 'claude'}`,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        Authorization:`Bearer ${await token()}`
      },
      body:JSON.stringify({
        message,
        history:histories[model].slice(-8)
      })
    });
    const data = await response.json().catch(()=>({}));
    typing.remove();
    if (!response.ok || !data.ok) throw new Error(data.error || 'La IA no respondió.');
    addMessage(model,'assistant',String(data.answer || 'Sin respuesta.'));
  } catch (error) {
    typing.remove();
    addMessage(model,'error',error.message,false);
  } finally {
    button.disabled = false;
  }
}

document.querySelectorAll('form[data-chat-model]').forEach(form => {
  const model = form.dataset.chatModel;
  const textarea = form.querySelector('textarea');
  const button = form.querySelector('button[type=submit]');

  textarea.addEventListener('input',() => {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight,145)}px`;
  });
  textarea.addEventListener('keydown',event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener('submit',event => {
    event.preventDefault();
    const value = textarea.value.trim();
    if (!value || button.disabled) return;
    textarea.value = '';
    textarea.style.height = 'auto';
    sendChat(model,value,button);
  });
});

document.querySelectorAll('[data-clear-chat]').forEach(button => {
  button.addEventListener('click',() => {
    const model = button.dataset.clearChat;
    histories[model] = [];
    saveHistory(model);
    renderHistory(model);
  });
});

document.querySelectorAll('[data-copy-last]').forEach(button => {
  button.addEventListener('click',async () => {
    const answer = lastAnswers[button.dataset.copyLast];
    if (!answer) return;
    await navigator.clipboard.writeText(answer);
    const old = button.textContent;
    button.textContent = 'Respuesta copiada';
    setTimeout(()=>button.textContent=old,1200);
  });
});

renderHistory('chatgpt');
renderHistory('claude');

function activateTool(name,updateHash=true) {
  const valid = ['chatgpt','claude','image-prompt','nano-banana'];
  const target = valid.includes(name) ? name : 'chatgpt';
  document.querySelectorAll('[data-ai-tool]').forEach(button => {
    button.classList.toggle('active',button.dataset.aiTool===target);
  });
  document.querySelectorAll('[data-ai-panel]').forEach(panel => {
    panel.classList.toggle('active',panel.dataset.aiPanel===target);
  });
  if (updateHash) history.replaceState(null,'',`#${target}`);
}

document.querySelectorAll('[data-ai-tool]').forEach(button => {
  button.addEventListener('click',()=>activateTool(button.dataset.aiTool));
});
activateTool(location.hash.slice(1),false);
window.addEventListener('hashchange',()=>activateTool(location.hash.slice(1),false));

function configureImageForm(form) {
  const methodInput = form.querySelector('input[name=method]');
  const fileInput = form.querySelector('input[type=file]');
  const urlInput = form.querySelector('input[name=url]');
  const localField = form.querySelector('[data-local-field]');
  const urlField = form.querySelector('[data-url-field]');
  const preview = form.querySelector('.ai-preview');

  form.querySelectorAll('[data-method]').forEach(button => {
    button.addEventListener('click',() => {
      const method = button.dataset.method;
      methodInput.value = method;
      form.querySelectorAll('[data-method]').forEach(item=>item.classList.toggle('active',item===button));
      localField.hidden = method !== 'local';
      urlField.hidden = method !== 'url';
      fileInput.required = method === 'local';
      urlInput.required = method === 'url';
      if (method === 'url') fileInput.value = '';
      if (method === 'local') urlInput.value = '';
    });
  });

  fileInput.addEventListener('change',() => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    objectUrls.add(url);
    preview.innerHTML = '';
    const image = document.createElement('img');
    image.src = url;
    image.alt = 'Vista previa';
    preview.appendChild(image);
  });

  urlInput.addEventListener('change',() => {
    if (!urlInput.value.trim()) return;
    preview.innerHTML = '';
    const image = document.createElement('img');
    image.src = urlInput.value.trim();
    image.alt = 'Vista previa';
    preview.appendChild(image);
  });
}

const imagePromptForm = $('#imagePromptForm');
const nanoForm = $('#nanoForm');
configureImageForm(imagePromptForm);
configureImageForm(nanoForm);

imagePromptForm.querySelector('[data-copy-result]').addEventListener('click',async () => {
  const text = imagePromptForm.querySelector('[data-result]').textContent;
  if (!text || text === 'El prompt aparecerá aquí.') return;
  await navigator.clipboard.writeText(text);
});

imagePromptForm.addEventListener('submit',async event => {
  event.preventDefault();
  const button = imagePromptForm.querySelector('button[type=submit]');
  const result = imagePromptForm.querySelector('[data-result]');
  const formData = new FormData(imagePromptForm);
  button.disabled = true;
  button.textContent = 'Analizando…';
  result.innerHTML = '<span class="ai-loading"><i></i><i></i><i></i></span>';

  try {
    const response = await fetch('/ai-api/image-to-prompt',{
      method:'POST',
      headers:{ Authorization:`Bearer ${await token()}` },
      body:formData
    });
    const data = await response.json().catch(()=>({}));
    if (!response.ok || !data.ok) throw new Error(data.error || 'No se pudo analizar la imagen.');
    result.textContent = data.prompt;
  } catch (error) {
    result.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = 'Analizar imagen';
  }
});

nanoForm.addEventListener('submit',async event => {
  event.preventDefault();
  const button = nanoForm.querySelector('button[type=submit]');
  const output = nanoForm.querySelector('[data-output]');
  const save = nanoForm.querySelector('[data-save-image]');
  const formData = new FormData(nanoForm);
  button.disabled = true;
  button.textContent = 'Generando…';
  output.innerHTML = '<span class="ai-loading"><i></i><i></i><i></i></span>';
  save.hidden = true;

  try {
    const response = await fetch('/ai-api/nanobanana',{
      method:'POST',
      headers:{ Authorization:`Bearer ${await token()}` },
      body:formData
    });
    if (!response.ok) {
      const data = await response.json().catch(()=>({}));
      throw new Error(data.error || 'No se pudo editar la imagen.');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    objectUrls.add(url);
    output.innerHTML = '';
    const image = document.createElement('img');
    image.src = url;
    image.alt = 'Imagen editada';
    output.appendChild(image);
    save.href = url;
    save.download = `arcadia-nano-${Date.now()}.${blob.type.includes('jpeg')?'jpg':'png'}`;
    save.hidden = false;
  } catch (error) {
    output.innerHTML = '';
    const text = document.createElement('div');
    text.className = 'ai-preview-empty';
    text.textContent = error.message;
    output.appendChild(text);
  } finally {
    button.disabled = false;
    button.textContent = 'Generar edición';
  }
});

window.addEventListener('pagehide',() => {
  objectUrls.forEach(url=>URL.revokeObjectURL(url));
},{ once:true });
