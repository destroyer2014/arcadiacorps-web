import { supabase, requireSession } from './auth.js';

export const ROLE_LABELS = Object.freeze({
  owner: 'Owner',
  staff: 'Staff',
  user: 'Usuario'
});

export async function getCurrentAccess() {
  const session = await requireSession();
  if (!session) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id,email,username,full_name,avatar_url,phone,role,created_at')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error) throw error;

  return {
    session,
    user: session.user,
    profile: profile || {
      id: session.user.id,
      email: session.user.email || '',
      username: session.user.user_metadata?.user_name || session.user.email?.split('@')[0] || 'usuario',
      full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
      avatar_url: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || '',
      role: 'user',
      created_at: session.user.created_at
    },
    role: profile?.role || 'user'
  };
}

export function hasRole(role, allowedRoles) {
  return allowedRoles.includes(role);
}

export async function requireRole(allowedRoles) {
  const access = await getCurrentAccess();
  if (!access) return null;

  if (!hasRole(access.role, allowedRoles)) {
    const target = new URL('access-denied.html', window.location.href);
    target.searchParams.set('required', allowedRoles.join(','));
    window.location.replace(target.href);
    return null;
  }
  return access;
}
