#!/usr/bin/env bash
# Nightly Postgres backup for ReduCera (Phase 9).
# Writes a compressed dump + sha256, records BackupRecord row.
# Usage: backup.sh [tag]

set -euo pipefail

TAG="${1:-nightly-$(date -u +%Y%m%dT%H%M%SZ)}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
DATABASE_URL="${DATABASE_URL:?Set DATABASE_URL to the Postgres connection string}"
NEST_API="${NEST_API:-http://api:3002}"

mkdir -p "${BACKUP_DIR}"
DUMP_PATH="${BACKUP_DIR}/${TAG}.dump.gz"

echo "Starting backup ${TAG} → ${DUMP_PATH}"
START_TIME=$(date -u +%s)

pg_dump "${DATABASE_URL}" | gzip > "${DUMP_PATH}"

SIZE=$(stat -c%s "${DUMP_PATH}")
SHA=$(sha256sum "${DUMP_PATH}" | awk '{print $1}')

END_TIME=$(date -u +%s)
DURATION=$((END_TIME - START_TIME))

# Persist to api (best-effort; if api is down, log locally only)
if command -v curl > /dev/null; then
  curl -sfS -X POST \
    -H 'Content-Type: application/json' \
    -H "Idempotency-Key: ${TAG}" \
    -d "{\"tag\":\"${TAG}\",\"sizeBytes\":${SIZE},\"checksum\":\"${SHA}\",\"storageUri\":\"file://${DUMP_PATH}\"}" \
    "${NEST_API}/v1/admin/backup/run" > /dev/null || \
    echo "api unreachable; backup not recorded in api ledger"
fi

echo "Backup ${TAG} complete in ${DURATION}s (${SIZE} bytes, sha256=${SHA})"