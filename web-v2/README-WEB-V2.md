# ArcadiaCorps Web 2.0 — Autenticación real

Primera base limpia. Incluye inicio de sesión real por correo, Google y GitHub mediante Supabase Auth, callback PKCE, sesión persistente, dashboard protegido y cierre de sesión.

No incluye publicaciones, noticias, subbots ni estadísticas ficticias.

## URLs que deben registrarse en Supabase Auth

Para probar dentro del dominio principal:
- https://arcadiacorps.online/web-v2/auth/callback.html
- https://arcadiacorps.online/web-v2/**

Para el futuro subdominio beta:
- https://beta.arcadiacorps.online/auth/callback.html
- https://beta.arcadiacorps.online/**

## Proveedores
Activa Google y GitHub en Supabase Dashboard > Authentication > Providers y coloca allí los Client ID/Secret. Los secretos nunca van en este repositorio.
