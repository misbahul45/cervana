from __future__ import annotations

import pytest

from config.retrieval_governance import GovernanceError
from v1.domain.governance import (
    DEFAULT_DOMAIN,
    learner_summary_governance,
    outline_governance,
    resource_governance,
    retrieval_scope,
)


def test_the_default_domain_is_accounting():
    assert DEFAULT_DOMAIN == "ACCOUNTING"


def test_a_concept_outline_is_published_platform_content_about_its_own_concept():
    governance = outline_governance("l1-t01-accounting-equation")

    assert governance.payload("golden:l1-t01-accounting-equation", 0) == {
        "schema_version": 1,
        "doc_kind": "concept-outline",
        "domain_id": "ACCOUNTING",
        "status": "PUBLISHED",
        "access_scope": "PLATFORM",
        "concept_ids": ["l1-t01-accounting-equation"],
        "chunk_id": "golden:l1-t01-accounting-equation:0",
        "topic_id": "l1-t01-accounting-equation",
    }


def test_a_resource_is_platform_content_located_by_the_ids_of_its_record():
    governance = resource_governance({"id": "r-1", "lessonId": "l-1", "topicId": "t-1", "subTopicId": "s-1", "stepId": "st-1", "title": "x"})

    payload = governance.payload("r-1", 3)
    assert payload["doc_kind"] == "resource" and payload["access_scope"] == "PLATFORM" and payload["status"] == "PUBLISHED"
    assert (payload["resource_id"], payload["lesson_id"], payload["topic_id"], payload["sub_topic_id"], payload["step_id"]) == ("r-1", "l-1", "t-1", "s-1", "st-1")
    assert payload["concept_ids"] == []


def test_a_resource_without_a_location_is_still_valid():
    payload = resource_governance({"id": "r-1"}).payload("r-1", 0)

    assert "lesson_id" not in payload and payload["resource_id"] == "r-1"


def test_a_resource_record_without_an_id_is_refused():
    with pytest.raises(GovernanceError):
        resource_governance({"lessonId": "l-1"})


def test_a_learner_summary_is_private_to_its_author():
    payload = learner_summary_governance("u-1", topic_id="t-1", lesson_id="l-1").payload("t-1-l-1-u-1", 0)

    assert payload["doc_kind"] == "learner-summary"
    assert payload["access_scope"] == "OWNER" and payload["owner_id"] == "u-1"
    assert payload["status"] == "PUBLISHED" and payload["topic_id"] == "t-1" and payload["lesson_id"] == "l-1"


def test_a_learner_summary_without_an_author_is_refused():
    with pytest.raises(GovernanceError):
        learner_summary_governance("", topic_id="t-1", lesson_id="l-1")


class TestRetrievalScope:
    def test_without_a_snapshot_the_scope_is_domain_wide_for_the_actor(self):
        scope = retrieval_scope("u-1")

        assert (scope.actor_id, scope.domain_id, scope.concept_ids, scope.tenant_ids) == ("u-1", "ACCOUNTING", (), ())

    def test_the_concepts_of_the_snapshot_narrow_the_scope_in_order_without_repeats(self):
        snapshot = {"concepts": [{"conceptId": "c2"}, {"conceptId": "c1"}, {"conceptId": "c2"}], "next": None}

        assert retrieval_scope("u-1", snapshot).concept_ids == ("c2", "c1")

    @pytest.mark.parametrize("snapshot", [None, {}, {"concepts": None}, {"concepts": "x"}, {"concepts": [None, 3, {"title": "no id"}, {"conceptId": ""}]}])
    def test_a_missing_or_malformed_snapshot_gives_a_domain_wide_scope(self, snapshot):
        assert retrieval_scope("u-1", snapshot).concept_ids == ()

    def test_a_scope_still_needs_an_actor(self):
        with pytest.raises(GovernanceError):
            retrieval_scope("")
