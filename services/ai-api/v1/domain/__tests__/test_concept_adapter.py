from __future__ import annotations

import pytest

from config.agent_session import mint_session
from errors.types import AuthError, CrossServiceError
from v1.domain.adapter import ConceptCatalog, fetch_learner_state

REGISTRY = {
    "concepts": [
        {"id": "l1-t01-accounting-equation", "title": "The Accounting Equation", "level": 1, "sortOrder": 1, "prerequisiteIds": []},
        {"id": "l1-t03-journal-entries", "title": "Journal Entries", "level": 1, "sortOrder": 3, "prerequisiteIds": ["l1-t01-accounting-equation"]},
        {"id": "l2-t01-balance-sheet", "title": "Balance Sheet", "level": 2, "sortOrder": 1, "prerequisiteIds": []},
        {"id": "l2-t02-income-statement", "title": "Income Statement", "level": 2, "sortOrder": 2, "prerequisiteIds": []},
    ],
    "aliases": {
        "PYTHON_DOMAIN": {
            "accounting_equation": ["l1-t01-accounting-equation"],
            "journal_entry": ["l1-t03-journal-entries"],
            "financial_statements": ["l2-t01-balance-sheet", "l2-t02-income-statement"],
        }
    },
}


class Clock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


def session():
    return mint_session(acting_user_id="u-1", trace_id="trace-1", idempotency_key="request-key-0001")


@pytest.fixture
def clock():
    return Clock()


@pytest.fixture
def catalog(clock):
    return ConceptCatalog(ttl_seconds=300, clock=clock)


@pytest.fixture
def served(internal_wire):
    internal_wire.respond(200, {"data": REGISTRY})
    return internal_wire


def test_the_catalog_reads_the_registry_over_the_signed_internal_route(catalog, served):
    catalog.load(session())

    prepared = served.sent[0]
    assert prepared.method == "GET"
    assert prepared.url.endswith("/internal/concepts")
    assert prepared.headers["x-service-id"] == "ai-api"
    assert prepared.headers["x-service-signature"]
    assert "Authorization" not in prepared.headers


def test_an_api_concept_id_resolves_to_itself(catalog, served):
    catalog.load(session())

    assert catalog.resolve("l1-t03-journal-entries") == ["l1-t03-journal-entries"]


def test_a_python_id_resolves_through_its_approved_alias(catalog, served):
    catalog.load(session())

    assert catalog.resolve("journal_entry") == ["l1-t03-journal-entries"]


def test_an_umbrella_python_id_resolves_to_every_target_in_order(catalog, served):
    catalog.load(session())

    assert catalog.resolve("financial_statements") == ["l2-t01-balance-sheet", "l2-t02-income-statement"]


def test_an_unmapped_or_unknown_id_resolves_to_nothing_instead_of_a_guess(catalog, served):
    catalog.load(session())

    assert catalog.resolve("contra_account") == []
    assert catalog.resolve("normal_balance") == []
    assert catalog.resolve("") == []


def test_the_python_ids_of_an_api_concept_are_the_reverse_of_the_aliases(catalog, served):
    catalog.load(session())

    assert catalog.python_ids_for("l1-t01-accounting-equation") == ["accounting_equation"]
    assert catalog.python_ids_for("l2-t02-income-statement") == ["financial_statements"]
    assert catalog.python_ids_for("l2-t99-nothing") == []


def test_the_title_of_a_concept_comes_from_the_registry(catalog, served):
    catalog.load(session())

    assert catalog.title_of("l1-t03-journal-entries") == "Journal Entries"
    assert catalog.title_of("unknown") is None


def test_the_catalog_is_not_read_again_inside_the_cache_window(catalog, served, clock):
    catalog.load(session())
    clock.now += 299
    catalog.load(session())

    assert len(served.sent) == 1


def test_the_catalog_is_read_again_after_the_cache_window(catalog, served, clock):
    catalog.load(session())
    clock.now += 301
    catalog.load(session())

    assert len(served.sent) == 2


def test_stale_data_is_served_when_the_refresh_fails(catalog, internal_wire, clock):
    internal_wire.respond(200, {"data": REGISTRY})
    catalog.load(session())
    clock.now += 301
    internal_wire.respond(503, {"message": "down"})

    catalog.load(session())

    assert catalog.resolve("journal_entry") == ["l1-t03-journal-entries"]


def test_a_failed_first_read_raises_so_the_caller_can_decide(catalog, internal_wire):
    internal_wire.respond(503, {"message": "down"})

    with pytest.raises(CrossServiceError):
        catalog.load(session())


def test_a_catalog_that_was_never_loaded_resolves_nothing(catalog):
    assert catalog.resolve("journal_entry") == []
    assert catalog.python_ids_for("l1-t03-journal-entries") == []


def test_a_malformed_registry_is_rejected_and_not_cached(catalog, internal_wire):
    internal_wire.respond(200, {"data": {"concepts": "nope"}})

    with pytest.raises(CrossServiceError):
        catalog.load(session())

    internal_wire.respond(200, {"data": REGISTRY})
    catalog.load(session())
    assert catalog.resolve("journal_entry") == ["l1-t03-journal-entries"]


def test_the_learner_state_of_a_lesson_is_read_for_the_acting_user(internal_wire):
    state = {"userId": "u-1", "concepts": [], "next": {"conceptId": "c1", "level": 1, "reasonCodes": ["NO_EVIDENCE_START"], "concept": None}}
    internal_wire.respond(200, {"data": state})

    result = fetch_learner_state(session(), lesson_id="lesson-1")

    prepared = internal_wire.sent[0]
    assert result == state
    assert prepared.method == "GET"
    assert "/internal/learner-state?" in prepared.url
    assert "lessonId=lesson-1" in prepared.url
    assert prepared.headers["x-acting-user-id"] == "u-1"
    assert "Authorization" not in prepared.headers


def test_the_learner_state_of_a_user_step_is_read_for_the_acting_user(internal_wire):
    internal_wire.respond(200, {"data": {"userId": "u-1", "concepts": [], "next": None}})

    fetch_learner_state(session(), user_step_id="us-1")

    prepared = internal_wire.sent[0]
    assert "userStepId=us-1" in prepared.url
    assert "lessonId" not in prepared.url


def test_a_forbidden_learner_state_read_surfaces_as_an_auth_error(internal_wire):
    internal_wire.respond(403, {"message": "no"})

    with pytest.raises(AuthError):
        fetch_learner_state(session(), lesson_id="lesson-1")
