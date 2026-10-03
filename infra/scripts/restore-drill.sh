#!/usr/bin/env bash
# Monthly restore drill for ReduCera (Phase 9).
# Restores the latest backup into a temporary Postgres and runs api smoke tests.
# Usage: restore-drill.sh [backup-tag]

set -euo pipefail

LATEST_TAG="${1:-}"
NEST_API="${NEST_API:-http://api:3002}"
PG_HOST="${PG_HOST:-postgres}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-reducera_prod}"
PG_PASSWORD="${PG_PASSWORD:?Set PG_PASSWORD}"
PG_DB_RESTORE="${PG_DB_RESTORE:-reducera_drill}"
DUMP_PATH=""

if [ -z "${LATEST_TAG}" ]; then
  echo "Fetching latest backup tag..."
  LATEST_TAG=$(curl -sfS "${NEST_API}/v1/admin/backup" | grep -o '"tag":"[^"]*"' | head -1 | cut -d'"' -f4 || true)
fi
if [ -z "${LATEST_TAG}" ]; then
  echo "No backup tag available; aborting"
  exit 1
fi

DUMP_PATH="/backups/${LATEST_TAG}.dump.gz"
if [ ! -f "${DUMP_PATH}" ]; then
  echo "Dump file not found: ${DUMP_PATH}"
  exit 1
fi

echo "Restoring drill for ${LATEST_TAG} into ${PG_DB_RESTORE}"

# Create temporary db if not exists
PGPASSWORD="${PG_PASSWORD}" psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" \
  -c "CREATE DATABASE ${PG_DB_RESTORE};" 2>/dev/null || true

# Drop + recreate public schema
PGPASSWORD="${PG_PASSWORD}" psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" \
  -d "${PG_DB_RESTORE}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Restore
gunzip < "${DUMP_PATH}" | PGPASSWORD="${PG_PASSWORD}" psql \
  -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${PG_DB_RESTORE}"

# Smoke test
cd "$(dirname "$0")/../../services/api"
DATABASE_URL="postgresql://${PG_USER}:${PG_PASSWORD}@${PG_HOST}:${PG_PORT}/${PG_DB_RESTORE}" \
  TEST_DATABASE_URL="$DATABASE_URL" pnpm jest --silent --testPathPattern=smoke 2>&1 | tail -5

echo "Restore drill for ${LATEST_TAG} complete"