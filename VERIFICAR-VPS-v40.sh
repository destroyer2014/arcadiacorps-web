#!/usr/bin/env bash
set -u

BASE="${1:-https://arcadiacorps.online}"
FAIL=0

check() {
  local label="$1"
  local url="$2"
  local expected="${3:-200}"

  code="$(curl -L -sS -o /dev/null -w '%{http_code}' --max-time 15 "$url" || echo 000)"

  if [ "$code" = "$expected" ]; then
    printf 'OK   %-24s %s\n' "$label" "$code"
  else
    printf 'FAIL %-24s %s (esperado %s)\n' "$label" "$code" "$expected"
    FAIL=1
  fi
}

echo "=== ArcadiaCorps v40 — verificación ==="
check "Web dashboard" "$BASE/web-v2/dashboard.html"
check "Login" "$BASE/web-v2/login.html"
check "IA" "$BASE/web-v2/ais.html"
check "Sub-Bots" "$BASE/web-v2/subbots.html"
check "404 personalizada" "$BASE/web-v2/esta-pagina-no-existe-v40" "404"
check "AI health" "$BASE/ai-api/health"
check "Nero API health" "$BASE/nero-api/health"

echo
echo "Nginx:"
if nginx -t; then
  echo "OK: configuración Nginx válida."
else
  echo "FAIL: nginx -t reportó un error."
  FAIL=1
fi

echo
echo "PM2:"
pm2 status arcadia-ai-api arcadia-subbots-api nero-bot || FAIL=1

exit "$FAIL"
