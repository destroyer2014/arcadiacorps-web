#!/usr/bin/env bash
set -euo pipefail

WEB_DIR="${1:-/var/www/arcadiacorps}"
SRC="$WEB_DIR/server/subbots-api/server.js"
DST="/opt/arcadia-subbots-api"

if [ ! -f "$SRC" ]; then
  echo "ERROR: No existe $SRC"
  exit 1
fi

if [ ! -f "$DST/.env" ]; then
  echo "ERROR: Falta $DST/.env. No se modifica ninguna credencial."
  exit 1
fi

cp -f "$SRC" "$DST/server.js"
cd "$DST"
pm2 restart arcadia-subbots-api --update-env
pm2 save

sleep 2
echo "API Sub-Bots restaurada al flujo estable de códigos:"
curl -fsS http://127.0.0.1:3310/health
echo
