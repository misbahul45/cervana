#!/usr/bin/env bash
set -euo pipefail

OLD_PREFIX="${OLD_PREFIX:-cervana}"
NEW_PREFIX="${NEW_PREFIX:-reducera}"
VOLUMES="${VOLUMES:-postgres_data redis_data qdrant_data hf_cache nginx_logs}"
HELPER_IMAGE="${HELPER_IMAGE:-alpine:3.20}"

for suffix in $VOLUMES; do
  old="${OLD_PREFIX}_${suffix}"
  new="${NEW_PREFIX}_${suffix}"

  if ! docker volume inspect "$old" >/dev/null 2>&1; then
    echo "skip   $old (not found)"
    continue
  fi

  if docker volume inspect "$new" >/dev/null 2>&1; then
    echo "skip   $new (already exists)"
    continue
  fi

  if [ -n "$(docker ps -q --filter "volume=$old")" ]; then
    echo "abort  $old is mounted by a running container, stop it first" >&2
    exit 1
  fi

  docker volume create "$new" >/dev/null
  docker run --rm -v "$old":/from:ro -v "$new":/to "$HELPER_IMAGE" sh -c 'cp -a /from/. /to/'
  echo "copied $old -> $new"
done
