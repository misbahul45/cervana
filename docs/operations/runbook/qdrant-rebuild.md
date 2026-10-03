# Qdrant Collection Rebuild Runbook

## Preconditions

- `DATABASE_URL` set (for `content_embeddings` table in api)
- `QDRANT_URL` set (e.g. `http://qdrant:6333`)
- `OPENAI_API_KEY` / `HF_TOKEN` set (whichever embedding provider is configured)

## Steps

1. Verify the source data is intact:
   ```
   psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"content_embeddings\""
   ```

2. Flush the existing collection (drop and recreate is faster for full rebuild):
   ```
   curl -X DELETE "$QDRANT_URL/collections/reducera-embedding"
   curl -X PUT "$QDRANT_URL/collections/reducera-embedding" \
     -H 'Content-Type: application/json' \
     -d '{"vectors": {"size": <DIM>, "distance": "Cosine"}}'
   ```

3. Trigger the content processor queue (BullMQ) to repopulate:
   ```
   curl -X POST http://ai-api:3003/ai/v1/admin/reindex-content \
     -H 'Content-Type: application/json' \
     -d '{"batchSize": 100}'
   ```

4. Monitor the celery worker logs:
   ```
   docker logs --tail 200 reducera_celery_worker | grep -E 'embedding|reducera-embedding'
   ```

5. Verify the collection populates:
   ```
   curl "$QDRANT_URL/collections/reducera-embedding" | jq '.result.points_count'
   ```

## Expected output

- Points count grows over time as the worker processes the queue.
- `pnpm jest src/v1/sandbox` smoke tests pass.

## What to verify before declaring recovery complete

- `[OK] points_count ≈ count(content_embeddings)`
- `[OK] /v1/sandbox/scenarios returns the seeded scenarios`
- `[OK] /v1/learning/lessons/:id returns content`