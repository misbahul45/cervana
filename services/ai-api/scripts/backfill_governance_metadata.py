from __future__ import annotations

import argparse
import logging
import sys

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("backfill-governance")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Add governance metadata to the stored concept outline chunks")
    parser.add_argument("--dry-run", action="store_true", help="report what would change and write nothing")
    args = parser.parse_args(argv)

    from config.embedding_pipeline import COLLECTION_NAME, qdrant_client
    from config.governance_backfill import backfill_outline_governance, ensure_payload_indexes

    created = ensure_payload_indexes(qdrant_client, COLLECTION_NAME) if not args.dry_run else []
    report = backfill_outline_governance(qdrant_client, COLLECTION_NAME, dry_run=args.dry_run)

    log.info("payload indexes created: %s", created or "none")
    log.info("seen=%d updated=%d unchanged=%d skipped=%d", report.seen, report.updated, report.unchanged, len(report.skipped))
    if report.skipped:
        log.error("skipped points: %s", report.skipped)
    return 1 if report.skipped else 0


if __name__ == "__main__":
    sys.exit(main())
