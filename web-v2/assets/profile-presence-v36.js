import { getPresenceController } from './presence-v36.js';

const controller = await getPresenceController();
if (controller && location.pathname.endsWith('/profile.html')) {
  const side = document.querySelector('.profile-side');
  const hero = document.querySelector('.profile-hero');

  if (side && !document.querySelector('#presenceSettingsPanel')) {
    const rows = await controller.snapshot([controller.userId]).catch(()=>[]);
    const own = rows[0] || {};
    const panel = document.createElement('section');
    panel.id = 'presenceSettingsPanel';
    panel.className = 'panel presence-settings';
    panel.innerHTML = `
      <h3 class="panel-title"><span class="icon">●</span>Privacidad y presencia</h3>
      <div class="presence-status-card">
        <span class="arc-presence-dot" data-presence-user="${controller.userId}"></span>
        <div class="presence-status-copy">
          <strong id="profilePresenceTitle">Comprobando estado…</strong>
          <small id="profileLastSeen">${controller.fmtLastSeen(own.last_seen)}</small>
        </div>
      </div>
      <label class="presence-switch">
        <span>
          <strong>Mostrar mi estado en línea</strong>
          <small>Otros usuarios podrán ver cuándo estás conectado.</small>
        </span>
        <input id="presenceVisibility" class="presence-toggle" type="checkbox"
          ${controller.visible ? 'checked' : ''}>
      </label>
      <div id="presenceMessage" class="message"></div>`;
    side.prepend(panel);

    const toggle = panel.querySelector('#presenceVisibility');
    const title = panel.querySelector('#profilePresenceTitle');
    const message = panel.querySelector('#presenceMessage');

    const render = event => {
      const online = event?.detail?.online || controller.online;
      title.textContent = controller.visible
        ? (online.has(controller.userId) ? 'En línea' : 'Conectando…')
        : 'Estado oculto';
    };
    render();
    window.addEventListener('arcadia:presence',render);

    toggle.addEventListener('change',async () => {
      toggle.disabled = true;
      try {
        await controller.setVisibility(toggle.checked);
        message.textContent = toggle.checked
          ? 'Tu estado vuelve a ser visible.'
          : 'Tu estado en línea quedó oculto.';
        message.className = 'message show ok';
      } catch (error) {
        toggle.checked = !toggle.checked;
        message.textContent = error.message;
        message.className = 'message show error';
      } finally {
        toggle.disabled = false;
      }
    });
  }

  if (hero && !hero.querySelector('.profile-live-presence')) {
    const chip = document.createElement('span');
    chip.className = 'badge good profile-live-presence';
    chip.innerHTML = `<span class="arc-presence-dot" data-presence-user="${controller.userId}"></span>
      <span>Presencia</span>`;
    hero.querySelector('.profile-badges')?.appendChild(chip);
  }
}
