import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authorization = req.headers.get('Authorization') || ''
  const token = authorization.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Sesión requerida.' }, 401)

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: callerData, error: callerError } = await callerClient.auth.getUser(token)
  const caller = callerData.user
  if (callerError || !caller) return json({ error: 'Sesión inválida o vencida.' }, 401)

  const { data: callerProfile, error: profileError } = await admin
    .from('profiles').select('id,role,is_active').eq('id', caller.id).maybeSingle()
  if (profileError || !callerProfile || callerProfile.role !== 'owner' || callerProfile.is_active === false) {
    return json({ error: 'Solo un Owner activo puede ejecutar esta acción.' }, 403)
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Solicitud inválida.' }, 400) }
  const action = String(body.action || '')

  try {
    if (action === 'list_users') {
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (error) throw error
      const ids = data.users.map(u => u.id)
      const { data: profiles } = ids.length
        ? await admin.from('profiles').select('id,email,display_name,username,role,is_active').in('id', ids)
        : { data: [] as any[] }
      const profileMap = new Map((profiles || []).map(p => [p.id, p]))
      return json({ users: data.users.map(u => {
        const p = profileMap.get(u.id) || {}
        return {
          id: u.id,
          email: u.email,
          email_confirmed_at: u.email_confirmed_at,
          last_sign_in_at: u.last_sign_in_at,
          created_at: u.created_at,
          banned_until: u.banned_until,
          display_name: p.display_name,
          username: p.username,
          role: p.role || 'user',
          is_active: p.is_active !== false,
        }
      }) })
    }

    const userId = String(body.user_id || '')
    const reason = String(body.reason || '').trim()
    if (!userId) return json({ error: 'Falta el usuario.' }, 400)
    if (reason.length < 5 || reason.length > 500) return json({ error: 'El motivo debe tener entre 5 y 500 caracteres.' }, 400)
    if (userId === caller.id && ['temp_password','ban'].includes(action)) {
      return json({ error: 'No puedes bloquear ni reemplazar tu propia contraseña desde este panel.' }, 400)
    }

    const { data: targetData, error: targetError } = await admin.auth.admin.getUserById(userId)
    if (targetError || !targetData.user) return json({ error: 'Cuenta no encontrada.' }, 404)
    const target = targetData.user
    let metadata: Record<string, unknown> = {}

    if (action === 'recovery') {
      if (!target.email) return json({ error: 'La cuenta no tiene correo.' }, 400)
      const redirectTo = `${new URL(req.url).origin.replace(/\/functions\/v1.*$/, '')}`
      const siteRedirect = Deno.env.get('PASSWORD_RESET_REDIRECT') || 'https://arcadiacorps.online/restablecer-clave.html'
      const { error } = await admin.auth.resetPasswordForEmail(target.email, { redirectTo: siteRedirect })
      if (error) throw error
      metadata = { email: target.email, redirect_to: siteRedirect, function_origin: redirectTo }
    } else if (action === 'confirm_email') {
      const { error } = await admin.auth.admin.updateUserById(userId, { email_confirm: true })
      if (error) throw error
      metadata = { email: target.email }
    } else if (action === 'change_email') {
      const email = String(body.email || '').trim().toLowerCase()
      if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'Correo inválido.' }, 400)
      const oldEmail = target.email
      const { error } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true })
      if (error) throw error
      await admin.from('profiles').update({ email }).eq('id', userId)
      metadata = { old_email: oldEmail, new_email: email }
    } else if (action === 'temp_password') {
      const password = String(body.password || '')
      if (password.length < 10) return json({ error: 'La contraseña temporal debe tener al menos 10 caracteres.' }, 400)
      const { error } = await admin.auth.admin.updateUserById(userId, {
        password,
        user_metadata: { ...(target.user_metadata || {}), must_change_password: true },
      })
      if (error) throw error
      metadata = { must_change_password: true }
    } else if (action === 'ban') {
      const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: '876000h' })
      if (error) throw error
      await admin.from('profiles').update({ is_active: false }).eq('id', userId)
      metadata = { banned: true }
    } else if (action === 'unban') {
      const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' })
      if (error) throw error
      await admin.from('profiles').update({ is_active: true }).eq('id', userId)
      metadata = { banned: false }
    } else {
      return json({ error: 'Acción desconocida.' }, 400)
    }

    const { error: auditError } = await admin.from('admin_audit_logs').insert({
      actor_id: caller.id,
      target_user_id: userId,
      action,
      reason,
      metadata,
    })
    if (auditError) console.error('audit insert:', auditError)
    return json({ ok: true })
  } catch (error) {
    console.error(error)
    const message = error instanceof Error ? error.message : 'Error interno.'
    return json({ error: message }, 400)
  }
})
