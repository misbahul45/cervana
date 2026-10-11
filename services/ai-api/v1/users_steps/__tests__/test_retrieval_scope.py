from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from config.agent_session import mint_session
from config.retrieval_governance import Governance, GovernanceError, RetrievalScope
from v1.users_steps import generate_quiz_pipeline
from v1.users_steps.__tests__.test_pipelines_routing import QUIZ
from v1.users_steps.service import build_learning_introduction_llm


class FakeLLM:
    def stream(self, prompt):
        return iter([])


def make_pipeline(results=None):
    calls: list[dict] = []
    return SimpleNamespace(
        llm=FakeLLM(),
        retrieve=lambda **kwargs: (calls.append(kwargs), results if results is not None else [])[1],
        calls=calls,
    )


def run_introduction(pipeline, session):
    async def consume():
        return [chunk async for chunk in build_learning_introduction_llm([SimpleNamespace(title="Jurnal", description="d")], pipeline, None, session)]

    return asyncio.run(consume())


def test_the_introduction_retrieves_in_the_scope_of_the_acting_user():
    pipeline = make_pipeline()

    run_introduction(pipeline, mint_session(acting_user_id="u-7"))

    assert pipeline.calls[0]["scope"] == RetrievalScope(actor_id="u-7", domain_id="ACCOUNTING")
    assert pipeline.calls[0]["top_k"] == 5
    assert pipeline.calls[0]["query"] == "Jurnal"


def test_without_a_session_the_introduction_reads_nothing_from_the_store():
    pipeline = make_pipeline()

    run_introduction(pipeline, None)

    assert pipeline.calls == []


class TestQuizSummaryWrite:
    def state(self):
        return SimpleNamespace(
            topic_id="t-1",
            lesson_id="l-1",
            acting_user_id="u-1",
            context="materi akuntansi",
            learning_style=SimpleNamespace(dominant_style="visual"),
            quiz=None,
            session_id="s",
            tenant_id="tn",
            trace_id="tr",
            idempotency_key="k",
        )

    @pytest.fixture
    def recorder(self):
        writes: list[dict] = []
        reads: list[dict] = []
        fake = SimpleNamespace(
            upsert_document=lambda **kwargs: writes.append(kwargs),
            retrieve=lambda **kwargs: (reads.append(kwargs), [{"text": "rag"}])[1],
        )
        with patch.object(generate_quiz_pipeline, "get_embedding_pipeline", return_value=fake):
            yield writes, reads

    def test_the_summary_is_stored_as_private_to_its_author(self, scripted_llm, recorder):
        import json

        writes, _ = recorder
        scripted_llm.reply("flash", "ringkasan materi", json.dumps(QUIZ))

        generate_quiz_pipeline.analyze_text(self.state())

        governance = writes[0]["governance"]
        assert isinstance(governance, Governance)
        assert (governance.doc_kind, governance.access_scope, governance.owner_id) == ("learner-summary", "OWNER", "u-1")
        assert (governance.topic_id, governance.lesson_id) == ("t-1", "l-1")

    def test_the_quiz_reads_back_only_what_the_actor_may_see(self, scripted_llm, recorder):
        import json

        _, reads = recorder
        scripted_llm.reply("flash", "ringkasan materi", json.dumps(QUIZ))

        generate_quiz_pipeline.analyze_text(self.state())

        assert reads[0]["scope"] == RetrievalScope(actor_id="u-1", domain_id="ACCOUNTING")
        assert reads[0]["top_k"] == 10


def test_a_failed_retrieval_does_not_stop_the_introduction():
    from errors.types import RetrievalError

    def failing(**kwargs):
        raise RetrievalError("retrieval failed")

    pipeline = SimpleNamespace(llm=FakeLLM(), retrieve=failing)

    assert run_introduction(pipeline, mint_session(acting_user_id="u-7")) == []


def test_a_failed_retrieval_does_not_stop_the_quiz(scripted_llm):
    import json

    from errors.types import RetrievalError

    def failing(**kwargs):
        raise RetrievalError("retrieval failed")

    fake = SimpleNamespace(upsert_document=lambda **kwargs: None, retrieve=failing)
    state = TestQuizSummaryWrite().state()
    scripted_llm.reply("flash", "ringkasan materi", json.dumps(QUIZ))

    with patch.object(generate_quiz_pipeline, "get_embedding_pipeline", return_value=fake):
        result = generate_quiz_pipeline.analyze_text(state)

    assert result.quiz[0].question == "Soal?"
