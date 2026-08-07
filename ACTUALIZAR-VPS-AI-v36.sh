#!/usr/bin/env bash
set -euo pipefail

SOURCE="/var/www/arcadiacorps/server/arcadia-ai-api"
TARGET="/opt/arcadia-ai-api"

if [ ! -f "$SOURCE/server.mjs" ]; then
  echo "ERROR: No existe $SOURCE/server.mjs"
  exit 1
fi

mkdir -p "$TARGET"

if [ -f "$TARGET/.env" ]; then
  cp "$TARGET/.env" "/tmp/arcadia-ai-env-backup"
fi

cp -f "$SOURCE/server.mjs" "$TARGET/server.mjs"
cp -f "$SOURCE/package.json" "$TARGET/package.json"

if [ -f "/tmp/arcadia-ai-env-backup" ]; then
  mv "/tmp/arcadia-ai-env-backup" "$TARGET/.env"
else
  echo "Pega la clave de EvoGB. No se mostrará:"
  read -r -s EVOGB_KEY
  echo
  cat > "$TARGET/.env" <<EOF
PORT=3311
EVOGB_API_KEY=$EVOGB_KEY
SUPABASE_URL=https://dtfecbsokpgzyuiyxyvm.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_SU7zJytoYMgoGtYoobINDQ_qLSO0bw1
PUBLIC_BASE_URL=https://arcadiacorps.online/ai-api
EOF
fi

grep -q '^PUBLIC_BASE_URL=' "$TARGET/.env" || \
  echo 'PUBLIC_BASE_URL=https://arcadiacorps.online/ai-api' >> "$TARGET/.env"

chmod 600 "$TARGET/.env"
cd "$TARGET"
npm install --omit=dev

pm2 restart arcadia-ai-api --update-env
pm2 save

sleep 2
curl -fsS http://127.0.0.1:3311/health
echo
echo "Arcadia AI API v36 actualizada."
