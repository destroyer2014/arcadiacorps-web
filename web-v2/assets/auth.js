import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, APP_URL } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

export async function signInWithProvider(provider) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${APP_URL}/auth/callback.html`,
      skipBrowserRedirect: false
    }
  });
  if (error) throw error;
}

export async function signInWithPassword(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUpWithPassword(email, password) {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${APP_URL}/auth/callback.html` }
  });
  if (error) throw error;
}

export async function requireSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) {
    window.location.replace(`${APP_URL}/login.html`);
    return null;
  }
  return data.session;
}
