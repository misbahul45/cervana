from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace

from config.agent_session import mint_session
from errors.types import RetrievalError
from v1.users_steps.service import build_learning_introduction_llm
from v1.users_steps.streaming import StageEvent, chunk_text


class _Chunk:
    def __init__(self, text):
        self.text = text


class _LLM:
    def stream(self, prompt):
        return iter([_Chunk("Halo "), _Chunk("dunia")])


def _pipeline(retrieve):
    return SimpleNamespace(llm=_LLM(), retrieve=retrieve)


def _steps():
    return [
        SimpleNamespace(title="Apa itu akuntansi", description="d"),
        SimpleNamespace(title="Siklus akuntansi", description="d"),
    ]


def _run(pipeline, session, learning_style=None):
    async def consume():
        return [chunk async for chunk in build_learning_introduction_llm(_steps(), pipeline, learning_style, session)]

    return asyncio.run(consume())


def _stages(chunks):
    return [chunk for chunk in chunks if isinstance(chunk, StageEvent)]


def test_stages_arrive_in_pipeline_order_before_the_first_word():
    chunks = _run(_pipeline(lambda **kw: [{"text": "a"}, {"text": "b"}]), mint_session(acting_user_id="u-1"))

    assert [stage.key for stage in _stages(chunks)] == ["context", "profile", "retrieval", "writing"]
    assert isinstance(chunks[3], StageEvent)
    assert [chunk_text(chunk) for chunk in chunks[4:]] == ["Halo ", "dunia"]


def test_context_stage_reports_the_real_step_count_and_titles():
    stage = _stages(_run(_pipeline(lambda **kw: []), mint_session(acting_user_id="u-1")))[0]

    assert stage.state == "done"
    assert stage.data == {"steps": 2, "titles": ["Apa itu akuntansi", "Siklus akuntansi"]}


def test_profile_stage_names_the_style_it_found_or_says_it_was_skipped():
    with_style = _stages(
        _run(_pipeline(lambda **kw: []), mint_session(acting_user_id="u-1"), SimpleNamespace(dominant_style="suka membaca catatan"))
    )[1]
    without_style = _stages(_run(_pipeline(lambda **kw: []), mint_session(acting_user_id="u-1")))[1]

    assert (with_style.state, with_style.data) == ("done", {"style": "reading_writing"})
    assert (without_style.state, without_style.data) == ("skipped", {"style": None})


def test_retrieval_stage_counts_the_sources_that_were_really_found():
    retrieval = _stages(_run(_pipeline(lambda **kw: [{"text": "a"}, {"text": "b"}]), mint_session(acting_user_id="u-1")))[2]

    assert retrieval.state == "done"
    assert retrieval.data == {"queries": 2, "sources": 4, "failed": 0}


def test_retrieval_stage_says_failed_when_every_lookup_failed():
    def broken(**kw):
        raise RetrievalError("retrieval failed")

    retrieval = _stages(_run(_pipeline(broken), mint_session(acting_user_id="u-1")))[2]

    assert retrieval.state == "failed"
    assert retrieval.data == {"queries": 2, "sources": 0, "failed": 2}


def test_retrieval_stage_is_skipped_without_a_session():
    retrieval = _stages(_run(_pipeline(lambda **kw: [{"text": "a"}]), None))[2]

    assert retrieval.state == "skipped"
    assert retrieval.data == {"queries": 0, "sources": 0, "failed": 0}


def test_stage_event_serialises_to_plain_json_and_is_never_text():
    stage = StageEvent("context", "done", {"titles": ["Pengantar Akuntansi — Dasar"]})

    assert json.loads(stage.to_json()) == {"key": "context", "state": "done", "data": {"titles": ["Pengantar Akuntansi — Dasar"]}}
    assert chunk_text(stage) is None
