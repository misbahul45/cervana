from __future__ import annotations

from unittest.mock import patch

import pytest

from config.agent_session import mint_session
from errors.types import AuthError, CrossServiceError
from v1.domain.adapter import ConceptCatalog
from v1.tutor import learner_block

REGISTRY = {
    "concepts": [{"id": "c2", "title": "Journal Entries", "level": 1, "sortOrder": 2, "prerequisiteIds": []}],
    "aliases": {"PYTHON_DOMAIN": {"journal_entry": ["c2"]}},
}

STATE = {
    "userId": "u-1",
    "concepts": [
        {
            "conceptId": "c2",
            "title": "Journal Entries",
            "level": 1,
            "mastery": {"score": 0.62, "confidence": 0.05, "evidenceCount": 1, "lastEventAt": None},
            "prerequisites": [],
            "prerequisiteMasteryMet": True,
        }
    ],
    "next": {"conceptId": "c3", "level": 1, "reasonCodes": ["PREREQUISITES_MET"], "concept": {"id": "c3", "title": "Ledger", "level": 1}},
}


@pytest.fixture
def session():
    return mint_session(acting_user_id="u-1", trace_id="trace-1", idempotency_key="request-key-0001")


@pytest.fixture
def catalog(internal_wire):
    internal_wire.respond(200, {"data": REGISTRY})
    with patch.object(learner_block, "get_concept_catalog", return_value=ConceptCatalog()) as getter:
        yield getter.return_value


def test_a_lesson_is_resolved_to_the_rendered_block(session, catalog):
    with patch.object(learner_block, "fetch_learner_state", return_value=STATE) as fetch:
        text = learner_block.learner_snapshot_block(session, lesson_id="l-1")

    assert 'concept c2 "Journal Entries" domain_ids=[journal_entry]: score=0.62' in text
    assert "next_concept=c3" in text
    assert fetch.call_args.kwargs == {"lesson_id": "l-1"}


def test_a_user_step_is_resolved_the_same_way(session, catalog):
    with patch.object(learner_block, "fetch_learner_state", return_value=STATE) as fetch:
        text = learner_block.learner_snapshot_block(session, user_step_id="us-1")

    assert "mastery_scale" in text
    assert fetch.call_args.kwargs == {"user_step_id": "us-1"}


def test_nothing_is_read_without_a_lesson_or_a_user_step(session, catalog):
    with patch.object(learner_block, "fetch_learner_state") as fetch:
        assert learner_block.learner_snapshot_block(session) == ""
        assert learner_block.learner_snapshot_block(session, lesson_id="", user_step_id="") == ""

    fetch.assert_not_called()


@pytest.mark.parametrize("failure", [CrossServiceError("down"), AuthError("no"), ValueError("bad shape")])
def test_a_failed_read_leaves_the_block_out(session, catalog, failure):
    with patch.object(learner_block, "fetch_learner_state", side_effect=failure):
        assert learner_block.learner_snapshot_block(session, lesson_id="l-1") == ""


def test_a_malformed_state_leaves_the_block_out(session, catalog):
    with patch.object(learner_block, "fetch_learner_state", return_value={"concepts": [{"mastery": "oops"}], "next": 5}):
        assert learner_block.learner_snapshot_block(session, lesson_id="l-1") == ""


def test_an_unreachable_registry_only_costs_the_domain_ids(session, internal_wire):
    internal_wire.respond(503, {"message": "down"})
    with patch.object(learner_block, "get_concept_catalog", return_value=ConceptCatalog()), patch.object(
        learner_block, "fetch_learner_state", return_value=STATE
    ):
        text = learner_block.learner_snapshot_block(session, lesson_id="l-1")

    assert 'concept c2 "Journal Entries": score=0.62' in text
    assert "domain_ids" not in text


def test_the_snapshot_can_be_read_once_and_rendered_separately(session, catalog):
    with patch.object(learner_block, "fetch_learner_state", return_value=STATE) as fetch:
        snapshot = learner_block.read_learner_snapshot(session, lesson_id="l-1")
        text = learner_block.render_snapshot_block(session, snapshot)

    assert snapshot == STATE
    assert fetch.call_count == 1
    assert "next_concept=c3" in text


def test_reading_without_a_lesson_or_a_user_step_returns_nothing_and_does_not_call_the_api(session):
    with patch.object(learner_block, "fetch_learner_state") as fetch:
        assert learner_block.read_learner_snapshot(session) is None

    fetch.assert_not_called()


@pytest.mark.parametrize("failure", [CrossServiceError("down"), AuthError("no")])
def test_a_failed_read_returns_nothing_instead_of_raising(session, failure):
    with patch.object(learner_block, "fetch_learner_state", side_effect=failure):
        assert learner_block.read_learner_snapshot(session, lesson_id="l-1") is None


def test_rendering_nothing_gives_an_empty_block_and_does_not_load_the_registry(session):
    with patch.object(learner_block, "get_concept_catalog") as getter:
        assert learner_block.render_snapshot_block(session, None) == ""

    getter.assert_not_called()
