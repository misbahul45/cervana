from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from config.retrieval_governance import GovernanceError
from errors.types import RetrievalError
from v1.users_steps import generate_quiz_pipeline
from v1.users_steps.dto import GenerateQuestionPipeline

QUIZ_JSON = json.dumps(
    {
        "quiz": [
            {
                "question": "Klien bertanya tentang persamaan dasar akuntansi, apa jawabanmu?",
                "type": "scenario",
                "difficulty": "easy",
                "options": [],
                "answer": "Aset = Liabilitas + Ekuitas",
            }
        ]
    }
)


def _state() -> GenerateQuestionPipeline:
    return GenerateQuestionPipeline(
        topic_id="topic-1",
        lesson_id="lesson-1",
        learning_style_id="style-1",
        session_id="session-1",
        acting_user_id="user-1",
        tenant_id="tenant-1",
        trace_id="trace-1",
        idempotency_key="key-1",
        context="=== TOPIC ===\nAkuntansi dasar",
    )


def _router():
    router = MagicMock()
    router.invoke.side_effect = [SimpleNamespace(text="Ringkasan materi akuntansi."), SimpleNamespace(text=QUIZ_JSON)]
    return router


def _run(pipeline):
    with (
        patch.object(generate_quiz_pipeline, "get_embedding_pipeline", return_value=pipeline),
        patch.object(generate_quiz_pipeline, "get_router", return_value=_router()),
    ):
        return generate_quiz_pipeline.analyze_text(_state())


def test_quiz_is_built_when_the_summary_cannot_be_stored():
    pipeline = MagicMock()
    pipeline.upsert_document.side_effect = RuntimeError("HF embedding request failed with 402")
    pipeline.retrieve.return_value = []

    result = _run(pipeline)

    assert len(result.quiz) == 1
    pipeline.retrieve.assert_called_once()


def test_quiz_is_built_when_retrieval_fails_as_well():
    pipeline = MagicMock()
    pipeline.upsert_document.side_effect = RuntimeError("HF embedding request failed with 402")
    pipeline.retrieve.side_effect = RetrievalError("retrieval failed")

    result = _run(pipeline)

    assert len(result.quiz) == 1


def test_a_governance_violation_is_not_swallowed():
    pipeline = MagicMock()
    pipeline.upsert_document.side_effect = GovernanceError("a document cannot be written without governance metadata")

    with pytest.raises(GovernanceError):
        _run(pipeline)
