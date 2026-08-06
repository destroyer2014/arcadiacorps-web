# API Subbots v30.1
1. Copiar a `/opt/arcadia-subbots-api`.
2. `cp .env.example .env` y completar las claves.
3. `npm install --omit=dev && npm run check`.
4. `pm2 start server.js --name arcadia-subbots-api && pm2 save`.
5. Instalar el bloque Nginx incluido y recargar.

La API escucha solo en `127.0.0.1:3310`. No publiques la service role en la web.
