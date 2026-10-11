#!/usr/bin/env bash
set -euo pipefail

API_DIR="${API_THEME_DIR:-services/api/prisma/seed-data}"
WEB_DIR="${WEB_THEME_DIR:-apps/web/app/theme}"
THEMES="${THEME_SLUGS:-reducera-ocean reducera-play}"

status=0
for slug in ${THEMES}; do
  api_file="${API_DIR}/${slug}.theme.json"
  web_file="${WEB_DIR}/${slug}.theme.json"

  if [[ ! -f "${api_file}" ]]; then
    echo "check-theme-sync: missing ${api_file}" >&2
    exit 2
  fi

  if [[ ! -f "${web_file}" ]]; then
    echo "check-theme-sync: missing ${web_file}" >&2
    exit 2
  fi

  if ! cmp -s "${api_file}" "${web_file}"; then
    echo "check-theme-sync: theme JSON files differ" >&2
    echo "  ${api_file}" >&2
    echo "  ${web_file}" >&2
    diff -u "${api_file}" "${web_file}" >&2 || true
    status=1
    continue
  fi

  echo "check-theme-sync: OK (${api_file} == ${web_file})"
done

exit "${status}"
