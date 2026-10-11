from __future__ import annotations

import pytest
from qdrant_client.models import Filter

from config.retrieval_governance import (
    CONTRACT_VERSION,
    Governance,
    GovernanceError,
    RetrievalScope,
    build_qdrant_filter,
)


def dump(flt: Filter) -> dict:
    return flt.model_dump(exclude_none=True)


class TestGovernance:
    def platform(self, **overrides):
        values = dict(doc_kind="concept-outline", domain_id="ACCOUNTING", status="PUBLISHED", access_scope="PLATFORM", concept_ids=["c1"])
        values.update(overrides)
        return Governance(**values)

    def test_a_platform_document_has_the_contract_keys(self):
        payload = self.platform().payload(source_id="golden:c1", chunk_index=2)

        assert payload == {
            "schema_version": CONTRACT_VERSION,
            "doc_kind": "concept-outline",
            "domain_id": "ACCOUNTING",
            "status": "PUBLISHED",
            "access_scope": "PLATFORM",
            "concept_ids": ["c1"],
            "chunk_id": "golden:c1:2",
        }

    def test_optional_locations_are_written_only_when_given(self):
        payload = self.platform(resource_id="r-1", lesson_id="l-1", topic_id="t-1", sub_topic_id="s-1", step_id="st-1").payload("res-1", 0)

        assert {k: payload[k] for k in ("resource_id", "lesson_id", "topic_id", "sub_topic_id", "step_id")} == {
            "resource_id": "r-1",
            "lesson_id": "l-1",
            "topic_id": "t-1",
            "sub_topic_id": "s-1",
            "step_id": "st-1",
        }
        assert "tenant_id" not in payload and "owner_id" not in payload

    @pytest.mark.parametrize(
        "overrides",
        [
            {"doc_kind": "page"},
            {"status": "LIVE"},
            {"access_scope": "PUBLIC"},
            {"domain_id": ""},
            {"concept_ids": "c1"},
            {"concept_ids": [1]},
            {"access_scope": "OWNER"},
            {"access_scope": "TENANT"},
            {"access_scope": "OWNER", "owner_id": ""},
        ],
    )
    def test_an_invalid_document_is_refused(self, overrides):
        with pytest.raises(GovernanceError):
            self.platform(**overrides)

    def test_a_learner_summary_is_a_known_document_kind(self):
        payload = self.platform(doc_kind="learner-summary", access_scope="OWNER", owner_id="u-1").payload("s", 0)

        assert payload["doc_kind"] == "learner-summary"

    def test_owner_and_tenant_documents_carry_their_ids(self):
        owner = self.platform(access_scope="OWNER", owner_id="u-1").payload("s", 0)
        tenant = self.platform(access_scope="TENANT", tenant_id="t-1").payload("s", 0)

        assert owner["owner_id"] == "u-1" and tenant["tenant_id"] == "t-1"

    def test_a_governance_object_cannot_be_changed_after_it_is_validated(self):
        governance = self.platform()

        with pytest.raises(Exception):
            governance.status = "DRAFT"


class TestScope:
    @pytest.mark.parametrize("overrides", [{"actor_id": ""}, {"domain_id": ""}, {"concept_ids": "c1"}, {"tenant_ids": "t1"}])
    def test_a_scope_needs_an_actor_and_a_domain_and_lists(self, overrides):
        values = dict(actor_id="u-1", domain_id="ACCOUNTING")
        values.update(overrides)

        with pytest.raises(GovernanceError):
            RetrievalScope(**values)


class TestFilter:
    def base_scope(self, **overrides):
        values = dict(actor_id="u-1", domain_id="ACCOUNTING")
        values.update(overrides)
        return RetrievalScope(**values)

    def test_the_default_filter_requires_published_domain_and_platform_or_owner(self):
        assert dump(build_qdrant_filter(self.base_scope())) == {
            "must": [
                {"key": "status", "match": {"value": "PUBLISHED"}},
                {"key": "domain_id", "match": {"value": "ACCOUNTING"}},
                {
                    "should": [
                        {"key": "access_scope", "match": {"value": "PLATFORM"}},
                        {
                            "must": [
                                {"key": "access_scope", "match": {"value": "OWNER"}},
                                {"key": "owner_id", "match": {"value": "u-1"}},
                            ]
                        },
                    ]
                },
            ]
        }

    def test_concept_ids_narrow_with_match_any_on_the_list_field(self):
        flt = dump(build_qdrant_filter(self.base_scope(concept_ids=["c1", "c2"])))

        assert {"key": "concept_ids", "match": {"any": ["c1", "c2"]}} in flt["must"]
        assert len(flt["must"]) == 4

    def test_tenant_ids_add_a_tenant_clause_to_the_access_rule_and_nothing_else(self):
        flt = dump(build_qdrant_filter(self.base_scope(tenant_ids=["t-1", "t-2"])))

        access = flt["must"][2]["should"]
        assert access[-1] == {
            "must": [
                {"key": "access_scope", "match": {"value": "TENANT"}},
                {"key": "tenant_id", "match": {"any": ["t-1", "t-2"]}},
            ]
        }
        assert len(access) == 3

    def test_no_tenant_clause_without_tenant_ids(self):
        access = dump(build_qdrant_filter(self.base_scope()))["must"][2]["should"]

        assert len(access) == 2

    def test_a_hostile_actor_or_concept_string_stays_a_value_and_never_becomes_a_condition(self):
        hostile = '" OR 1=1 --'
        flt = dump(build_qdrant_filter(self.base_scope(actor_id=hostile, concept_ids=[hostile])))

        assert flt["must"][0] == {"key": "status", "match": {"value": "PUBLISHED"}}
        assert flt["must"][2]["should"][1]["must"][1] == {"key": "owner_id", "match": {"value": hostile}}
        assert {"key": "concept_ids", "match": {"any": [hostile]}} in flt["must"]
        assert "should" not in flt and "must_not" not in flt

    def test_the_status_and_domain_conditions_are_always_first_and_top_level(self):
        for scope in (self.base_scope(), self.base_scope(concept_ids=["c"]), self.base_scope(tenant_ids=["t"])):
            must = dump(build_qdrant_filter(scope))["must"]

            assert must[0]["key"] == "status" and must[1]["key"] == "domain_id"

    def test_the_same_scope_always_builds_the_same_filter(self):
        scope = self.base_scope(concept_ids=["c1"], tenant_ids=["t"])

        assert dump(build_qdrant_filter(scope)) == dump(build_qdrant_filter(scope))
