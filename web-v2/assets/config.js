export const SUPABASE_URL = 'https://dtfecbsokpgzyuiyxyvm.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_SU7zJytoYMgoGtYoobINDQ_qLSO0bw1';

export const APP_URL = (() => {
  const url = new URL(window.location.href);
  const basePath = url.pathname.includes('/web-v2/') ? '/web-v2' : '';
  return `${url.origin}${basePath}`;
})();
