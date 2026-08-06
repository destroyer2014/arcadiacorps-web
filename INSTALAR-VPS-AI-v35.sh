#!/usr/bin/env bash
set -euo pipefail

SOURCE="$(cd "$(dirname "$0")" && pwd)/server/arcadia-ai-api"
TARGET="/opt/arcadia-ai-api"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js no está instalado."
  exit 1
fi

if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

echo "Pega la NUEVA clave de EvoGB. No se mostrará en pantalla:"
read -r -s EVOGB_KEY
echo

if [ -z "$EVOGB_KEY" ]; then
  echo "ERROR: La clave está vacía."
  exit 1
fi

mkdir -p "$TARGET"
cp -f "$SOURCE/server.mjs" "$TARGET/server.mjs"
cp -f "$SOURCE/package.json" "$TARGET/package.json"

cat > "$TARGET/.env" <<EOF
PORT=3311
EVOGB_API_KEY=$EVOGB_KEY
SUPABASE_URL=https://dtfecbsokpgzyuiyxyvm.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_SU7zJytoYMgoGtYoobINDQ_qLSO0bw1
EOF

chmod 600 "$TARGET/.env"
cd "$TARGET"
npm install --omit=dev

pm2 delete arcadia-ai-api >/dev/null 2>&1 || true
pm2 start server.mjs --name arcadia-ai-api
pm2 save

echo ""
echo "Servicio IA iniciado."
echo "Prueba local: curl http://127.0.0.1:3311/health"
echo "Falta añadir nginx-ai-api.conf dentro del server de arcadiacorps.online."
