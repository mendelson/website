#!/usr/bin/env bash
# Cross-repo analytics check: does a visit that walks mmendelson.com ->
# apps.mmendelson.com -> run.mmendelson.com stay ONE measured journey, and
# does consent behave the way the banner promises?
#
#   bash tools/analytics-family-check/run.sh
#
# Needs the three repos checked out side by side (website, apps-website,
# corridas — override with MM_SITE_ROOTS), python3, node, and playwright
# (NODE_PATH may have to point at a global install). It builds the hub first,
# so it always tests the generated site rather than a stale public/.
#
# Nothing reaches the internet except one fetch of gtag.js: every hostname the
# browser uses is resolved to the local server, which answers 204 for anything
# that would be a hit and logs it to collected.log. No test data can land in
# the live GA4 property.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
PORT="${MM_PORT:-8443}"
FAMILY_ID="${MM_FAMILY_ID:-G-0MHS4QK452}"

cd "$HERE"
rm -f collected.log

echo "==> building the hub"
python3 "$REPO/build.py" > /dev/null

if [ ! -f family.pem ]; then
  echo "==> generating a self-signed certificate for *.mmendelson.com"
  openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 30 -nodes \
    -subj "/CN=mmendelson.com" \
    -addext "subjectAltName=DNS:mmendelson.com,DNS:*.mmendelson.com,DNS:www.googletagmanager.com,DNS:www.google-analytics.com" 2>/dev/null
  cat cert.pem key.pem > family.pem
fi

if [ ! -s tagmanager/gtag/js ]; then
  echo "==> fetching the real gtag.js (once)"
  mkdir -p tagmanager/gtag
  curl -sS "https://www.googletagmanager.com/gtag/js?id=$FAMILY_ID" -o tagmanager/gtag/js
fi

echo "==> starting the local family server on :$PORT"
python3 serve_family.py family.pem "$PORT" > server.log 2>&1 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null || true' EXIT
sleep 2

echo "==> running the browser checks"
MM_PORT="$PORT" node verify.js
STATUS=$?

echo
echo "hits the tag tried to send (all answered 204 locally, none delivered):"
sed 's/^/  /' collected.log 2>/dev/null || echo "  none"
exit "$STATUS"
