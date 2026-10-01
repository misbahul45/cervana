#!/usr/bin/env bash
set -euo pipefail

API_THEME="${API_THEME:-services/api/prisma/seed-data/reducera-ocean.theme.json}"
WEB_THEME="${WEB_THEME:-apps/web/app/theme/reducera-ocean.theme.json}"

if [[ ! -f "${API_THEME}" ]]; then
  echo "check-theme-sync: missing ${API_THEME}" >&2
  exit 2
fi

if [[ ! -f "${WEB_THEME}" ]]; then
  echo "check-theme-sync: missing ${WEB_THEME}" >&2
  exit 2
fi

if ! cmp -s "${API_THEME}" "${WEB_THEME}"; then
  echo "check-theme-sync: theme JSON files differ" >&2
  echo "  ${API_THEME}" >&2
  echo "  ${WEB_THEME}" >&2
  diff -u "${API_THEME}" "${WEB_THEME}" >&2 || true
  exit 1
fi

echo "check-theme-sync: OK (${API_THEME} == ${WEB_THEME})"
