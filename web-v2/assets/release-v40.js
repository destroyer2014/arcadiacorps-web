(() => {
  'use strict';

  const VERSION = '40';
  const toastState = { timer:null };

  function toast(text) {
    let node = document.querySelector('#arcReleaseToast');

    if (!node) {
      node = document.createElement('div');
      node.id = 'arcReleaseToast';
      node.className = 'arc-release-toast';
      node.setAttribute('role','status');
      node.setAttribute('aria-live','polite');
      document.body.appendChild(node);
    }

    clearTimeout(toastState.timer);
    node.textContent = String(text || '');
    node.classList.add('show');

    toastState.timer = setTimeout(() => {
      node.classList.remove('show');
    }, 2600);
  }

  function setOffline(offline) {
    let banner = document.querySelector('#arcReleaseOffline');

    if (!offline) {
      banner?.remove();
      return;
    }

    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'arcReleaseOffline';
      banner.className = 'arc-release-offline';
      banner.setAttribute('role','status');
      banner.textContent = 'Sin conexión. Algunas funciones de ArcadiaCorps no estarán disponibles.';
      document.body.appendChild(banner);
    }
  }

  function hardenLinks() {
    document.querySelectorAll('a[target="_blank"]').forEach(link => {
      const rel = new Set((link.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
      rel.add('noopener');
      rel.add('noreferrer');
      link.setAttribute('rel',[...rel].join(' '));
    });
  }

  function optimizeImages() {
    document.querySelectorAll('img').forEach((image,index) => {
      if (!image.hasAttribute('decoding')) image.decoding = 'async';

      const critical =
        image.classList.contains('app-brand-logo') ||
        image.classList.contains('arc-error-logo') ||
        image.closest('.arc-ai-head') ||
        index < 2;

      if (!critical && !image.hasAttribute('loading')) {
        image.loading = 'lazy';
      }
    });
  }

  function annotateRelease() {
    document.documentElement.dataset.arcadiaRelease = VERSION;
  }

  window.addEventListener('offline',() => {
    setOffline(true);
    toast('ArcadiaCorps está sin conexión.');
  });

  window.addEventListener('online',() => {
    setOffline(false);
    toast('Conexión restablecida.');
  });

  // Registra errores para diagnóstico sin mostrar detalles técnicos al usuario.
  window.addEventListener('error',event => {
    console.error('[Arcadia v40]',event.error || event.message);
  });

  window.addEventListener('unhandledrejection',event => {
    console.error('[Arcadia v40 Promise]',event.reason);
  });

  function boot() {
    annotateRelease();
    hardenLinks();
    optimizeImages();
    setOffline(!navigator.onLine);

    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('/web-v2/sw-v40.js?v=40',{
        scope:'/web-v2/',
        updateViaCache:'none'
      }).catch(error => {
        console.warn('[Arcadia v40 SW]',error);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded',boot,{ once:true });
  } else {
    boot();
  }
})();
