(() => {
  const $ = selector => document.querySelector(selector);

  async function copyText(value) {
    const text = String(value || '').trim();
    if (!text) throw new Error('No hay contenido para copiar.');

    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly','');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    area.style.pointerEvents = 'none';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    if (!ok) throw new Error('No se pudo copiar.');
  }

  function feedback(button,text='Copiado') {
    const original = button.dataset.originalText || button.textContent;
    button.dataset.originalText = original;
    button.textContent = `✓ ${text}`;
    button.classList.add('copied');
    clearTimeout(button._copyTimer);
    button._copyTimer = setTimeout(() => {
      button.textContent = original;
      button.classList.remove('copied');
    },1400);
  }

  function rawPairCode() {
    const text = $('#pairCode')?.textContent || '';
    if (
      !text.trim() ||
      /generando|error|pendiente|—/i.test(text)
    ) return '';
    return text.replace(/[^a-z0-9]/gi,'').toUpperCase();
  }

  function mountPairCopy() {
    const output = $('#pairCode');
    if (!output || output.dataset.quickCopyMounted) return;

    output.dataset.quickCopyMounted = '1';

    const row = document.createElement('div');
    row.className = 'pair-code-copy-row';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pair-copy-button secondary';
    button.innerHTML = '<span>⧉</span><span>Copiar código</span>';
    button.disabled = true;

    output.parentNode.insertBefore(row,output);
    row.append(output,button);

    const sync = () => {
      const code = rawPairCode();
      button.disabled = !code;
      output.classList.toggle('ready',Boolean(code));
      output.title = code ? 'Toca para copiar el código' : '';
    };

    const doCopy = async () => {
      const code = rawPairCode();
      if (!code) return;
      try {
        await copyText(code);
        feedback(button,'Código copiado');
      } catch {
        feedback(button,'Error');
      }
    };

    button.addEventListener('click',doCopy);
    output.addEventListener('click',doCopy);
    output.addEventListener('keydown',event => {
      if ((event.key === 'Enter' || event.key === ' ') && rawPairCode()) {
        event.preventDefault();
        doCopy();
      }
    });

    output.tabIndex = 0;

    const observer = new MutationObserver(sync);
    observer.observe(output,{ childList:true,subtree:true,characterData:true });
    sync();
  }

  function mountIdCopies() {
    const list = $('#subbotList');
    if (!list) return;

    list.querySelectorAll('.subbot-card').forEach(card => {
      if (card.dataset.idCopyMounted) return;
      const idBlock = [...card.querySelectorAll('.subbot-meta > div')]
        .find(block => block.querySelector('small')?.textContent.trim().toUpperCase() === 'ID');
      const value = idBlock?.querySelector('strong');
      if (!idBlock || !value) return;

      card.dataset.idCopyMounted = '1';
      idBlock.classList.add('subbot-id-meta');

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'subbot-id-copy';
      button.setAttribute('aria-label','Copiar ID del Sub-Bot');
      button.title = 'Copiar ID';
      button.textContent = '⧉';

      button.addEventListener('click',async () => {
        try {
          await copyText(value.textContent);
          feedback(button,'');
        } catch {
          feedback(button,'!');
        }
      });

      idBlock.appendChild(button);
    });
  }

  function run() {
    mountPairCopy();
    mountIdCopies();

    const list = $('#subbotList');
    if (list && !list.dataset.quickCopyObserver) {
      list.dataset.quickCopyObserver = '1';
      const observer = new MutationObserver(() => {
        requestAnimationFrame(mountIdCopies);
      });
      observer.observe(list,{ childList:true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded',run,{ once:true });
  } else {
    run();
  }

  window.addEventListener('load',run,{ once:true });
})();
