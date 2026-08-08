import { TURNSTILE_SITE_KEY } from './captcha-config-v37.js?v=40.1';

const configured =
  Boolean(TURNSTILE_SITE_KEY) &&
  !TURNSTILE_SITE_KEY.includes('PEGA') &&
  !TURNSTILE_SITE_KEY.includes('REEMPLAZA');

let loaderPromise = null;

function loadTurnstile() {
  if (!configured) return Promise.resolve(null);
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve,reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.arcTurnstile = '1';
    script.onload = () => resolve(window.turnstile);
    script.onerror = () => reject(new Error('No se pudo cargar Cloudflare Turnstile.'));
    document.head.appendChild(script);
  });

  return loaderPromise;
}

export function captchaIsConfigured() {
  return configured;
}

export async function createCaptchaController(container) {
  if (!container || !configured) {
    if (container) container.hidden = true;
    return { configured:false, getToken:() => '', reset:() => {} };
  }

  container.hidden = false;
  const api = await loadTurnstile();
  let token = '';
  const widgetId = api.render(container, {
    sitekey: TURNSTILE_SITE_KEY,
    theme: 'dark',
    size: 'flexible',
    callback(value) { token = value || ''; },
    'expired-callback'() { token = ''; },
    'error-callback'() { token = ''; }
  });

  return {
    configured:true,
    getToken:() => token,
    reset() {
      token = '';
      api.reset(widgetId);
    }
  };
}
