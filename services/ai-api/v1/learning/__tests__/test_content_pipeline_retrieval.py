from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

from config.retrieval_governance import RetrievalScope
from errors.types import RetrievalError
from v1.learning import content_pipeline
from v1.learning.__tests__.test_content_pipeline_routing import make_state

SNAPSHOT = {"concepts": [{"conceptId": "c2"}, {"conceptId": "c3"}], "next": None}


def chunk(score=0.8, text="isi materi", **metadata):
    return {"score": score, "text": text, "metadata": metadata}


def run(results, snapshot=SNAPSHOT):
    fake = SimpleNamespace(retrieve=lambda **kwargs: (calls.append(kwargs), results)[1])
    calls: list[dict] = []
    with patch.object(content_pipeline, "pipeline", fake), patch.object(content_pipeline, "update_message_chat"):
        outcome = content_pipeline.retrieve_material_rag(make_state(), snapshot)
    return outcome, calls


def test_the_retrieval_runs_in_the_scope_of_the_acting_user_and_the_lesson_concepts():
    _, calls = run([])

    scope = calls[0]["scope"]
    assert scope == RetrievalScope(actor_id="u-1", domain_id="ACCOUNTING", concept_ids=("c2", "c3"))
    assert calls[0]["top_k"] == 10
    assert "metadata_filter" not in calls[0]


def test_without_a_snapshot_the_scope_has_no_concepts():
    _, calls = run([], snapshot=None)

    assert calls[0]["scope"].concept_ids == ()


def test_a_citation_names_only_what_the_chunk_itself_carries():
    (text, citations), _ = run(
        [chunk(0.9, "outline", source="golden:c2", chunk_id="golden:c2:0", concept_ids=["c2"], topic_id="c2")]
    )

    assert text == "outline"
    assert len(citations) == 1
    dumped = citations[0].model_dump(by_alias=True, exclude_none=True)
    assert dumped == {"conceptId": "c2", "chunkId": "golden:c2:0", "score": 0.9, "source": "golden:c2", "snippet": "outline"}


def test_a_chunk_of_another_lesson_is_never_cited_as_the_current_lesson():
    (_, citations), _ = run([chunk(0.9, source="r-9", chunk_id="r-9:0", resource_id="r-9", lesson_id="other-lesson")])

    assert citations[0].lesson_id == "other-lesson"
    assert citations[0].lesson_id != "l-1"


def test_a_chunk_without_any_locator_is_used_as_context_but_not_cited():
    (text, citations), _ = run([chunk(0.9, "tanpa lokasi", source="x")])

    assert text == "tanpa lokasi" and citations == []


def test_a_chunk_with_no_score_is_not_cited():
    (_, citations), _ = run([chunk(0.0, concept_ids=["c2"], chunk_id="a:0")])

    assert citations == []


def test_a_retrieval_error_gives_no_material_and_no_citations():
    def failing(**kwargs):
        raise RetrievalError("store down")

    with patch.object(content_pipeline, "pipeline", SimpleNamespace(retrieve=failing)), patch.object(content_pipeline, "update_message_chat"):
        assert content_pipeline.retrieve_material_rag(make_state(), SNAPSHOT) == ("", [])
