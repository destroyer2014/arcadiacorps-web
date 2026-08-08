import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, APP_URL } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce'
  }
});

function captchaOptions(captchaToken) {
  const token = String(captchaToken || '').trim();
  return token ? { captchaToken: token } : {};
}

export async function signInWithProvider(provider) {
  if (!['google','github'].includes(provider)) {
    throw new Error('Proveedor de acceso no permitido.');
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${APP_URL}/auth/callback.html?v=40.2`,
      skipBrowserRedirect: false
    }
  });
  if (error) throw error;
  return data;
}

export async function signInWithPassword(email, password, captchaToken = '') {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: captchaOptions(captchaToken)
  });
  if (error) throw error;
  return data;
}

export async function signUpWithPassword(email, password, captchaToken = '') {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${APP_URL}/auth/callback.html`,
      ...captchaOptions(captchaToken)
    }
  });
  if (error) throw error;
  return data;
}

export async function sendPasswordRecovery(email, captchaToken = '') {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${APP_URL}/update-password.html`,
    ...captchaOptions(captchaToken)
  });
  if (error) throw error;
  return data;
}

export async function exchangeAuthCode(code) {
  const clean = String(code || '').trim();
  if (!clean) return null;
  const { data, error } = await supabase.auth.exchangeCodeForSession(clean);
  if (error) throw error;
  return data.session || null;
}

export async function getValidatedSession() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) return null;

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    await supabase.auth.signOut({ scope:'local' }).catch(() => {});
    return null;
  }
  return { ...sessionData.session, user:userData.user };
}

export async function requireSession() {
  const session = await getValidatedSession();
  if (!session) {
    const next = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`);
    window.location.replace(`${APP_URL}/login.html?next=${next}`);
    return null;
  }
  return session;
}

export function safeNextPath(value, fallback = '/web-v2/dashboard.html?v=37') {
  const raw = String(value || '').trim();
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  try {
    const url = new URL(raw, location.origin);
    if (url.origin !== location.origin) return fallback;
    if (!url.pathname.startsWith('/web-v2/')) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
