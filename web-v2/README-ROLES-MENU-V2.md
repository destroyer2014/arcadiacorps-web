# ArcadiaCorps Web 2.0 — Roles, permisos y menú

Incluye:
- menú lateral responsive con datos reales del usuario;
- rol real desde `public.profiles.role`;
- guardas de acceso en frontend;
- panel Owner real para administrar roles;
- RLS y privilegios de columnas para impedir que un usuario cambie su propio rol;
- función RPC `admin_set_user_role` disponible solo para Owner.

Ejecuta `supabase/roles-permissions-v2.sql` antes de usar `admin-users.html`.
