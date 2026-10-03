# DB Restore Runbook

## Preconditions

- `DATABASE_URL` set (target connection string for the restored DB)
- Latest dump file in `/backups/`, e.g. `/backups/nightly-20260101T000000Z.dump.gz`
- `psql` and `pg_dump` available on the operator's host

## Steps

1. Pick the backup tag (newest `BackupRecord` row in api):
   ```
   curl -sfS http://api:3002/v1/admin/backup | jq '.[0].tag'
   ```

2. Locate the dump file at `/backups/<tag>.dump.gz`.

3. Run the restore drill:
   ```
   ./infra/scripts/restore-drill.sh <tag>
   ```

4. The script drops the public schema in a temporary DB and restores the dump.

6. The script runs `pnpm jest --testPathPattern=smoke` to validate the restore.

## Expected output

```
Restore drill for {tag} complete
```

## What to verify before declaring recovery complete

- `[OK] backup record persists with status: COMPLETED`
- `[OK] smoke test passes`
- `[OK] Compare audit log hashes pre/post-restore` (deterministic — they should match per row count)

## Failure modes

- **pg_dump error**: connection string or credential issue. Verify `psql` can connect manually.
- **Restore fails on schema conflict**: drop and recreate the target DB before restoring.
- **Smoke test fails**: indicates data corruption. Re-fetch the latest known-good backup tag and retry.