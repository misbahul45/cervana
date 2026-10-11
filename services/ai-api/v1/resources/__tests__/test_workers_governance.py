from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from v1.resources import workers

RECORD = {"id": "r-1", "type": "PDF", "title": "Buku", "lessonId": "l-1", "topicId": "t-1", "subTopicId": "s-1", "content": "isi", "jobStatus": "PENDING"}


def fake_pipeline():
    writes: list[dict] = []
    return SimpleNamespace(upsert_document=lambda **kwargs: writes.append(kwargs), writes=writes)


def test_an_embedded_resource_is_written_as_published_platform_content_with_its_location():
    pipeline = fake_pipeline()

    with patch.object(workers, "get_pipeline", return_value=pipeline), patch.object(workers, "callback_resource") as callback:
        workers.embedding_task.run(dict(RECORD), "u-1")

    governance = pipeline.writes[0]["governance"]
    assert (governance.doc_kind, governance.status, governance.access_scope) == ("resource", "PUBLISHED", "PLATFORM")
    assert (governance.resource_id, governance.lesson_id, governance.topic_id, governance.sub_topic_id) == ("r-1", "l-1", "t-1", "s-1")
    assert pipeline.writes[0]["source_id"] == "r-1"
    callback.assert_called_once()


def test_the_free_metadata_of_a_resource_keeps_the_record_but_not_the_job_fields():
    pipeline = fake_pipeline()

    with patch.object(workers, "get_pipeline", return_value=pipeline), patch.object(workers, "callback_resource"):
        workers.embedding_task.run(dict(RECORD), "u-1")

    metadata = pipeline.writes[0]["metadata"]
    assert metadata["title"] == "Buku" and metadata["id"] == "r-1"
    assert "content" not in metadata and "jobStatus" not in metadata


def test_an_extracted_resource_gets_the_same_governance():
    pipeline = fake_pipeline()

    with patch.object(workers, "get_pipeline", return_value=pipeline), patch.object(workers, "callback_resource"), patch.object(
        workers, "get_resource", return_value=_resource(id="r-2", lessonId="l-2")
    ), patch.object(workers, "extract_content", return_value="teks pdf"):
        workers.extract_task.run("PDF", "r-2", "u-1")

    governance = pipeline.writes[0]["governance"]
    assert (governance.resource_id, governance.lesson_id, governance.access_scope) == ("r-2", "l-2", "PLATFORM")


def _resource(**overrides):
    from datetime import datetime, timezone

    from v1.resources.dto import ResourceBase

    values = dict(id="r-1", type="PDF", isEmbedded=False, jobStatus="PENDING", createdAt=datetime.now(timezone.utc), updatedAt=datetime.now(timezone.utc), file={"url": "https://x/y.pdf"})
    values.update(overrides)
    return ResourceBase(**values)
