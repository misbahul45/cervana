#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost}"
ACCESS="CANARY_ACCESS_$(date +%s)"
REFRESH="CANARY_REFRESH_$(date +%s)"
PAGES=("/" "/login" "/marketplace")
failed=0

for page in "${PAGES[@]}"; do
  tmp="$(mktemp)"
  status="$(curl -s --max-time 20 -o "${tmp}" -w '%{http_code}' -H "Cookie: access_token=${ACCESS}; refresh_token=${REFRESH}" "${BASE_URL}${page}" || echo 000)"
  if [ "${status}" != "200" ] || ! grep -q "<html" "${tmp}"; then
    echo "INCONCLUSIVE: ${page} answered ${status} without an HTML document"
    failed=1
  elif grep -q -e "${ACCESS}" -e "${REFRESH}" "${tmp}"; then
    echo "LEAK: session cookie value is present in the HTML of ${page}"
    failed=1
  fi
  rm -f "${tmp}"
done

if [ "${failed}" -ne 0 ]; then
  exit 1
fi

echo "SSR secret leak check: PASS"
