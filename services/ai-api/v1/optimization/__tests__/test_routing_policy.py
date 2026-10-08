from __future__ import annotations

import pytest

from config.model_router import DEFAULT_TASK_MODES, RoutingOutcome, RoutingPolicy
from v1.optimization.routing_policy import (
    PolicyPromotionError,
    PolicyTuner,
    RoutingPolicyManager,
)

BASE = {"grounding": 0.80, "pedagogy": 0.80, "personalization": 0.80, "correctness": 0.90, "hallucination_rate": 0.05}
BETTER = {"grounding": 0.82, "pedagogy": 0.81, "personalization": 0.80, "correctness": 0.91, "hallucination_rate": 0.04}
WORSE = {**BETTER, "correctness": 0.85}
LATENCY = dict(latency_p95_ms_baseline=1000.0, latency_p95_ms_candidate=1050.0, cost_per_1k_baseline=1.0, cost_per_1k_candidate=1.1)


def policy(version, **overrides):
    return RoutingPolicy(version=version, task_modes=dict(DEFAULT_TASK_MODES), **overrides)


def manager(**kwargs):
    return RoutingPolicyManager(policy("routing-v1"), **kwargs)


def approved_candidate(m, version="routing-v2", **overrides):
    candidate = policy(version, **overrides)
    m.propose(candidate, proposed_by="weekly-tuner")
    m.evaluate(version, BASE, BETTER, **LATENCY)
    m.submit_for_approval(version)
    m.approve(version, decided_by="reviewer@example.com", rationale="replay ok")
    return candidate


class TestPromotionChain:
    def test_the_baseline_is_active_until_something_is_promoted(self):
        assert manager().active.version == "routing-v1"

    def test_a_candidate_cannot_start_a_canary_before_the_gate_ran(self):
        m = manager()
        m.propose(policy("routing-v2"), proposed_by="tuner")

        with pytest.raises(PolicyPromotionError, match="acceptance"):
            m.start_canary("routing-v2")

    def test_a_regressing_candidate_is_rejected_by_the_gate(self):
        m = manager()
        m.propose(policy("routing-v2"), proposed_by="tuner")

        decision = m.evaluate("routing-v2", BASE, WORSE, **LATENCY)

        assert decision.accepted is False
        assert "correctness" in decision.failed_dimensions
        with pytest.raises(PolicyPromotionError):
            m.submit_for_approval("routing-v2")

    def test_an_accepted_candidate_still_needs_human_approval(self):
        m = manager()
        m.propose(policy("routing-v2"), proposed_by="tuner")
        m.evaluate("routing-v2", BASE, BETTER, **LATENCY)
        m.submit_for_approval("routing-v2")

        with pytest.raises(PolicyPromotionError, match="approval"):
            m.start_canary("routing-v2")

    def test_a_rejected_approval_blocks_the_canary(self):
        m = manager()
        m.propose(policy("routing-v2"), proposed_by="tuner")
        m.evaluate("routing-v2", BASE, BETTER, **LATENCY)
        m.submit_for_approval("routing-v2")
        m.reject("routing-v2", decided_by="reviewer@example.com", rationale="too costly")

        with pytest.raises(PolicyPromotionError):
            m.start_canary("routing-v2")

    def test_an_approver_name_is_required(self):
        m = manager()
        m.propose(policy("routing-v2"), proposed_by="tuner")
        m.evaluate("routing-v2", BASE, BETTER, **LATENCY)
        m.submit_for_approval("routing-v2")

        with pytest.raises(ValueError):
            m.approve("routing-v2", decided_by="  ")

    def test_a_version_cannot_be_proposed_twice(self):
        m = manager()
        m.propose(policy("routing-v2"), proposed_by="tuner")

        with pytest.raises(PolicyPromotionError, match="already"):
            m.propose(policy("routing-v2"), proposed_by="tuner")


class TestCanary:
    def test_only_the_canary_share_of_traffic_sees_the_candidate(self):
        m = manager(canary_ratio=0.2)
        approved_candidate(m)
        m.start_canary("routing-v2")

        versions = [m.policy_for(f"user-{i}").version for i in range(2000)]
        share = versions.count("routing-v2") / len(versions)

        assert 0.15 < share < 0.25

    def test_a_given_key_always_gets_the_same_policy(self):
        m = manager(canary_ratio=0.5)
        approved_candidate(m)
        m.start_canary("routing-v2")

        assert {m.policy_for("learner-7").version for _ in range(20)} == {m.policy_for("learner-7").version}

    def test_without_a_canary_everybody_gets_the_active_policy(self):
        m = manager()
        approved_candidate(m)

        assert {m.policy_for(f"u{i}").version for i in range(50)} == {"routing-v1"}

    def test_promotion_requires_a_running_canary(self):
        m = manager()
        approved_candidate(m)

        with pytest.raises(PolicyPromotionError, match="canary"):
            m.promote("routing-v2")

    def test_promotion_makes_the_candidate_active_and_keeps_history(self):
        m = manager()
        approved_candidate(m)
        m.start_canary("routing-v2")

        m.promote("routing-v2")

        assert m.active.version == "routing-v2"
        assert {m.policy_for(f"u{i}").version for i in range(50)} == {"routing-v2"}
        assert [p.version for p in m.history] == ["routing-v1", "routing-v2"]


class TestRollback:
    def test_a_regression_during_the_canary_drops_the_candidate(self):
        m = manager(canary_ratio=0.5)
        approved_candidate(m)
        m.start_canary("routing-v2")

        event = m.observe("routing-v2", baseline_metrics=BASE, current_metrics={**BASE, "correctness": 0.70})

        assert event is not None and event.regression_dimension == "correctness"
        assert m.active.version == "routing-v1"
        assert {m.policy_for(f"u{i}").version for i in range(50)} == {"routing-v1"}
        with pytest.raises(PolicyPromotionError):
            m.promote("routing-v2")

    def test_stable_metrics_leave_the_canary_running(self):
        m = manager(canary_ratio=0.5)
        approved_candidate(m)
        m.start_canary("routing-v2")

        assert m.observe("routing-v2", baseline_metrics=BASE, current_metrics=BASE) is None
        assert m.canary is not None and m.canary.version == "routing-v2"

    def test_a_promoted_policy_can_be_rolled_back_to_the_previous_one(self):
        m = manager()
        approved_candidate(m)
        m.start_canary("routing-v2")
        m.promote("routing-v2")

        restored = m.rollback(reason="manual")

        assert restored.version == "routing-v1"
        assert m.active.version == "routing-v1"


def outcome(task="tutor_reply", complexity=0.5, first="flash", final="flash", ok=True):
    return RoutingOutcome(task=task, complexity=complexity, first_mode=first, final_mode=final, escalated=first != final, ok=ok, attempts=1 if first == final else 2, latency_ms=100.0)


class TestTuner:
    def test_frequent_flash_failures_lower_the_escalation_threshold(self):
        base = policy("routing-v1", escalate_above=0.8)
        failing = [outcome(complexity=0.6, first="flash", final="thinking") for _ in range(30)]

        proposal = PolicyTuner().propose(base, failing, version="routing-v2")

        assert proposal is not None
        assert proposal.escalate_above < 0.8
        assert proposal.version == "routing-v2"

    def test_a_clean_flash_record_lets_the_threshold_rise_to_save_cost(self):
        base = policy("routing-v1", escalate_above=0.5)
        smooth = [outcome(complexity=0.6, first="thinking", final="thinking") for _ in range(30)] + [
            outcome(complexity=0.4, first="flash", final="flash") for _ in range(30)
        ]

        proposal = PolicyTuner().propose(base, smooth, version="routing-v2")

        assert proposal is not None
        assert proposal.escalate_above > 0.5

    def test_too_little_evidence_proposes_nothing(self):
        assert PolicyTuner(min_samples=30).propose(policy("routing-v1"), [outcome()] * 5, version="routing-v2") is None

    def test_the_threshold_stays_within_its_bounds(self):
        base = policy("routing-v1", escalate_above=0.31)
        failing = [outcome(complexity=0.5, first="flash", final="thinking") for _ in range(100)]

        proposal = PolicyTuner(step=0.2).propose(base, failing, version="routing-v2")

        assert proposal is None or proposal.escalate_above >= 0.3

    def test_the_base_policy_is_never_mutated(self):
        base = policy("routing-v1", escalate_above=0.8)
        failing = [outcome(complexity=0.6, first="flash", final="thinking") for _ in range(30)]

        PolicyTuner().propose(base, failing, version="routing-v2")

        assert base.escalate_above == 0.8

    def test_task_modes_are_never_changed_by_the_tuner(self):
        base = policy("routing-v1")
        failing = [outcome(complexity=0.6, first="flash", final="thinking") for _ in range(30)]

        proposal = PolicyTuner().propose(base, failing, version="routing-v2")

        assert proposal is not None and dict(proposal.task_modes) == dict(base.task_modes)
