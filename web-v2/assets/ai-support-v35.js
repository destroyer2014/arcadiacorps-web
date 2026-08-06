import { supabase } from './auth.js';

const { data: { session } } = await supabase.auth.getSession();
if (session?.access_token) {
  const history = [];

  const escapeText = value => String(value ?? '');

  const root = document.createElement('div');
  root.id = 'arcAiSupport';
  root.innerHTML = `
    <button class="arc-ai-launcher" type="button" aria-label="Abrir soporte con IA">✦</button>
    <section class="arc-ai-panel" aria-hidden="true" aria-label="Soporte Arcadia IA">
      <header class="arc-ai-head">
        <div class="arc-ai-logo">AI</div>
        <div class="arc-ai-head-copy">
          <strong>Soporte Arcadia IA</strong>
          <small>ChatGPT conectado</small>
        </div>
        <button class="arc-ai-close" type="button" aria-label="Cerrar">×</button>
      </header>
      <div class="arc-ai-messages" aria-live="polite"></div>
      <form class="arc-ai-form">
        <textarea class="arc-ai-input" rows="1" maxlength="1800"
          placeholder="Escribe tu pregunta…"></textarea>
        <button class="arc-ai-send" type="submit" aria-label="Enviar">➤</button>
        <small class="arc-ai-note">La IA puede equivocarse. No compartas contraseñas ni claves.</small>
      </form>
    </section>`;
  document.body.appendChild(root);

  const launcher = root.querySelector('.arc-ai-launcher');
  const panel = root.querySelector('.arc-ai-panel');
  const close = root.querySelector('.arc-ai-close');
  const form = root.querySelector('.arc-ai-form');
  const input = root.querySelector('.arc-ai-input');
  const messages = root.querySelector('.arc-ai-messages');
  const sendButton = root.querySelector('.arc-ai-send');

  function addMessage(text, type='bot') {
    const node = document.createElement('div');
    node.className = `arc-ai-message ${type}`;
    node.textContent = escapeText(text);
    messages.appendChild(node);
    messages.scrollTop = messages.scrollHeight;
    return node;
  }

  function openPanel() {
    panel.classList.add('open');
    panel.setAttribute('aria-hidden','false');
    setTimeout(() => input.focus(), 80);
  }

  function closePanel() {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden','true');
  }

  launcher.addEventListener('click', () => {
    panel.classList.contains('open') ? closePanel() : openPanel();
  });
  close.addEventListener('click', closePanel);

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight,110)}px`;
  });

  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  addMessage(
    'Hola. Soy la IA de soporte de ArcadiaCorps. Puedo ayudarte con tu cuenta, Sub-Bots, Nero Bot, tickets, tienda, Social y las funciones de la web.'
  );

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message || sendButton.disabled) return;

    addMessage(message,'user');
    history.push({ role:'user', content:message });
    input.value = '';
    input.style.height = 'auto';
    sendButton.disabled = true;

    const typing = document.createElement('div');
    typing.className = 'arc-ai-message bot';
    typing.innerHTML = '<span class="arc-ai-typing"><i></i><i></i><i></i></span>';
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;

    try {
      const { data: { session: latestSession } } = await supabase.auth.getSession();
      const response = await fetch('/ai-api/chat', {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization':`Bearer ${latestSession?.access_token || ''}`
        },
        body:JSON.stringify({
          message,
          history:history.slice(-6)
        })
      });

      const data = await response.json().catch(() => ({}));
      typing.remove();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'El servicio de IA no está disponible.');
      }

      const answer = String(data.answer || 'No recibí una respuesta.');
      addMessage(answer,'bot');
      history.push({ role:'assistant', content:answer });
    } catch (error) {
      typing.remove();
      const message = error.message.includes('404')
        ? 'El chat ya está instalado en la web, pero falta activar el servicio de IA en el VPS.'
        : error.message;
      addMessage(message,'error');
    } finally {
      sendButton.disabled = false;
      input.focus();
    }
  });
}
