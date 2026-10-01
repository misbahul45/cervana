#!/usr/bin/env bash
set -euo pipefail

CONTAINER="${CONTAINER:-reducera_postgres}"
OLD_PREFIX="${OLD_PREFIX:-cervana}"
NEW_PREFIX="${NEW_PREFIX:-reducera}"
OLD_ROLE="${OLD_ROLE:-cervana_prod}"
NEW_ROLE="${NEW_ROLE:-reducera_prod}"
TMP_ROLE="rename_admin_$$"

psql_as() {
  local role="$1"
  shift
  docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -qAt -U "$role" -d postgres "$@"
}

role_exists() {
  [ "$(psql_as "$1" -c "select 1 from pg_roles where rolname = '$2'" 2>/dev/null || true)" = "1" ]
}

if role_exists "$OLD_ROLE" "$OLD_ROLE"; then
  admin="$OLD_ROLE"
elif role_exists "$NEW_ROLE" "$NEW_ROLE"; then
  admin="$NEW_ROLE"
else
  echo "abort  neither $OLD_ROLE nor $NEW_ROLE can connect to $CONTAINER" >&2
  exit 1
fi

active=$(psql_as "$admin" -c "select count(*) from pg_stat_activity where datname like '${OLD_PREFIX}%' and pid <> pg_backend_pid()")
if [ "$active" != "0" ]; then
  echo "abort  $active open connection(s) to ${OLD_PREFIX}* databases, stop api/tests first" >&2
  exit 1
fi

databases=$(psql_as "$admin" -c "select datname from pg_database where datname = '${OLD_PREFIX}' or datname like '${OLD_PREFIX}\\_%' order by datname")
for old_db in $databases; do
  new_db="${NEW_PREFIX}${old_db#"$OLD_PREFIX"}"
  if [ "$(psql_as "$admin" -c "select 1 from pg_database where datname = '$new_db'")" = "1" ]; then
    echo "skip   database $new_db (already exists)"
    continue
  fi
  psql_as "$admin" -c "alter database \"$old_db\" rename to \"$new_db\""
  echo "renamed database $old_db -> $new_db"
done

if [ "$admin" = "$OLD_ROLE" ]; then
  password_kind=$(psql_as "$admin" -c "select case when rolpassword like 'md5%' then 'md5' else 'ok' end from pg_authid where rolname = '$OLD_ROLE'")
  if [ "$password_kind" = "md5" ]; then
    echo "abort  $OLD_ROLE has an MD5 password, renaming would clear it" >&2
    exit 1
  fi
  psql_as "$admin" -c "create role \"$TMP_ROLE\" superuser login"
  psql_as "$TMP_ROLE" -c "alter role \"$OLD_ROLE\" rename to \"$NEW_ROLE\""
  psql_as "$NEW_ROLE" -c "drop role \"$TMP_ROLE\""
  echo "renamed role $OLD_ROLE -> $NEW_ROLE"
else
  echo "skip   role $NEW_ROLE (already renamed)"
fi
