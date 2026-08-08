import { supabase } from './auth.js?v=37';

const { data:{ session } } = await supabase.auth.getSession();

if (session?.access_token) {
  const history = [];
  const MAX_HISTORY = 8;

  const root = document.createElement('div');
  root.id = 'arcAiSupport';
  root.innerHTML = `
    <button class="arc-ai-launcher" type="button" aria-label="Abrir Nero AI">✦</button>

    <section class="arc-ai-panel" aria-hidden="true" aria-label="Nero AI — Soporte ArcadiaCorps">
      <header class="arc-ai-head">
        <div class="arc-ai-logo arc-ai-logo-nero">
          <img src="./assets/images/nero-ai-avatar.png?v=39"
               alt="Nero AI"
               draggable="false">
        </div>

        <div class="arc-ai-head-copy">
          <strong>Nero AI</strong>
          <small><span class="arc-ai-online-dot"></span>Nero AI Conectada</small>
        </div>

        <button class="arc-ai-close" type="button" aria-label="Cerrar">×</button>
      </header>

      <div class="arc-ai-messages" aria-live="polite"></div>

      <div class="arc-ai-quick-actions" aria-label="Preguntas rápidas">
        <button type="button" data-nero-quick="¿Cómo creo y vinculo mi Sub-Bot?">Sub-Bots</button>
        <button type="button" data-nero-quick="¿Cómo abro un ticket de soporte?">Tickets</button>
        <button type="button" data-nero-quick="¿Qué herramientas de IA tiene ArcadiaCorps?">IA's</button>
      </div>

      <form class="arc-ai-form">
        <textarea class="arc-ai-input"
                  rows="1"
                  maxlength="1800"
                  placeholder="Pregúntale a Nero AI…"></textarea>

        <button class="arc-ai-send" type="submit" aria-label="Enviar">➤</button>

        <small class="arc-ai-note">
          Nero AI puede orientarte dentro de ArcadiaCorps. Nunca compartas contraseñas, códigos ni claves.
        </small>
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
  let controller = null;

  function addMessage(text,type='bot') {
    const node = document.createElement('div');
    node.className = `arc-ai-message ${type}`;
    node.textContent = String(text ?? '');
    messages.appendChild(node);
    messages.scrollTop = messages.scrollHeight;
    return node;
  }

  function openPanel() {
    panel.classList.add('open');
    panel.setAttribute('aria-hidden','false');
    setTimeout(()=>input.focus(),80);
  }

  function closePanel() {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden','true');
  }

  launcher.addEventListener('click',()=>{
    panel.classList.contains('open') ? closePanel() : openPanel();
  });

  close.addEventListener('click',closePanel);

  input.addEventListener('input',()=>{
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight,110)}px`;
  });

  input.addEventListener('keydown',event=>{
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  addMessage('Hola, soy Nero AI para ayudarte.');

  root.querySelectorAll('[data-nero-quick]').forEach(button=>{
    button.addEventListener('click',()=>{
      input.value = button.dataset.neroQuick || '';
      form.requestSubmit();
    });
  });

  form.addEventListener('submit',async event=>{
    event.preventDefault();

    const message = input.value.trim();
    if (!message || sendButton.disabled) return;

    addMessage(message,'user');
    history.push({ role:'user',content:message });

    input.value = '';
    input.style.height = 'auto';
    sendButton.disabled = true;

    const typing = document.createElement('div');
    typing.className = 'arc-ai-message bot';
    typing.innerHTML = '<span class="arc-ai-typing"><i></i><i></i><i></i></span>';
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;

    controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(),60000);

    try {
      const { data:{ session:latestSession } } = await supabase.auth.getSession();

      if (!latestSession?.access_token) {
        throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
      }

      const response = await fetch('/ai-api/support',{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          Authorization:`Bearer ${latestSession.access_token}`
        },
        body:JSON.stringify({
          message,
          history:history.slice(-MAX_HISTORY),
          page:{
            pathname:location.pathname,
            hash:location.hash,
            title:document.title
          }
        }),
        signal:controller.signal
      });

      const data = await response.json().catch(()=>({}));
      typing.remove();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Nero AI no está disponible en este momento.');
      }

      const answer = String(data.answer || 'No recibí una respuesta.');
      addMessage(answer,'bot');

      history.push({ role:'assistant',content:answer });
      while (history.length > 16) history.shift();
    } catch (error) {
      typing.remove();

      const text = error.name === 'AbortError'
        ? 'Nero AI tardó demasiado en responder. Inténtalo nuevamente.'
        : error.message;

      addMessage(text,'error');
    } finally {
      clearTimeout(timeout);
      controller = null;
      sendButton.disabled = false;
      input.focus();
    }
  });

  window.addEventListener('pagehide',()=>{
    controller?.abort();
  },{ once:true });
}
