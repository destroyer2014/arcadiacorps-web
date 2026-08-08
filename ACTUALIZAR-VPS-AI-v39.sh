#!/usr/bin/env bash
set -euo pipefail

WEB_DIR="${1:-/var/www/arcadiacorps}"
SRC="$WEB_DIR/server/arcadia-ai-api"
DST="/opt/arcadia-ai-api"

if [ ! -f "$SRC/server.mjs" ]; then
  echo "ERROR: No existe $SRC/server.mjs"
  exit 1
fi

if [ ! -f "$DST/.env" ]; then
  echo "ERROR: Falta $DST/.env. No se tocará ninguna credencial."
  exit 1
fi

cp -f "$SRC/server.mjs" "$DST/server.mjs"

if [ -f "$SRC/package.json" ]; then
  cp -f "$SRC/package.json" "$DST/package.json"
fi

cd "$DST"
npm install --omit=dev
pm2 restart arcadia-ai-api --update-env
pm2 save

sleep 2

echo "Health de Arcadia AI:"
curl -fsS http://127.0.0.1:3311/health
echo
