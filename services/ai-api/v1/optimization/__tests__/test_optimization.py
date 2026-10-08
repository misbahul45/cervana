from __future__ import annotations

import pytest

from v1.optimization import (
    PROTECTED_CATEGORIES,
    AcceptanceGate,
    ApprovalStatus,
    BaselineSnapshot,
    CanarySplitter,
    Candidate,
    FailureCategory,
    FailureEpisode,
    FailureMiner,
    HumanApprovalRegistry,
    InvalidTransition,
    PolicyVersion,
    PolicyVersionRegistry,
    PromptRegistry,
    PromptStatus,
    PromptVersion,
    ProtectedCategory,
    RollbackManager,
    SafetyBoundaryGuard,
    SafetyViolation,
)


def _prompt(prompt_id: str = "p1", version: str = "v1", status: PromptStatus = PromptStatus.DRAFT) -> PromptVersion:
    return PromptVersion(
        prompt_id=prompt_id,
        version=version,
        status=status,
        artifact=f"prompt-text-{version}",
    )


def test_prompt_registry_starts_empty():
    registry = PromptRegistry()
    assert registry.all_active() == []


def test_prompt_registry_register_and_get():
    registry = PromptRegistry()
    registry.register(_prompt(version="v1", status=PromptStatus.DRAFT))
    assert registry.get("v1").status is PromptStatus.DRAFT


def test_prompt_registry_only_one_active_per_prompt_id():
    registry = PromptRegistry()
    registry.register(_prompt(version="v1", status=PromptStatus.ACTIVE))
    with pytest.raises(ValueError):
        registry.register(_prompt(version="v2", status=PromptStatus.ACTIVE))


def test_prompt_registry_valid_transitions_allowed():
    registry = PromptRegistry()
    registry.register(_prompt(version="v1", status=PromptStatus.DRAFT))
    registry.transition("v1", PromptStatus.EXPERIMENTAL, actor="alice")
    registry.transition("v1", PromptStatus.VALIDATED, actor="alice")
    registry.transition("v1", PromptStatus.ACTIVE, actor="alice")
    assert registry.get("v1").status is PromptStatus.ACTIVE


def test_prompt_registry_rejects_invalid_transition():
    registry = PromptRegistry()
    registry.register(_prompt(version="v1", status=PromptStatus.DRAFT))
    with pytest.raises(InvalidTransition):
        registry.transition("v1", PromptStatus.ACTIVE, actor="alice")


def test_prompt_registry_roll_back_restores_previous_active():
    registry = PromptRegistry()
    registry.register(_prompt(version="v1", status=PromptStatus.ACTIVE))
    registry.register(_prompt(version="v2", status=PromptStatus.DRAFT))
    registry.transition("v2", PromptStatus.EXPERIMENTAL, actor="alice")
    registry.transition("v2", PromptStatus.VALIDATED, actor="alice")
    registry.transition("v2", PromptStatus.ACTIVE, actor="alice")
    registry.transition("v2", PromptStatus.ROLLED_BACK, actor="alice")
    assert registry.get("v2").status is PromptStatus.ROLLED_BACK
    assert registry.active("p1").version == "v1"


def test_prompt_registry_records_history():
    registry = PromptRegistry()
    registry.register(_prompt(version="v1", status=PromptStatus.DRAFT))
    registry.transition("v1", PromptStatus.REJECTED, actor="alice", reason="bad prompt")
    history = registry.history()
    assert len(history) >= 2


def test_policy_version_registry_records_and_retrieves():
    registry = PolicyVersionRegistry()
    registry.register(PolicyVersion(policy_version="policy-1", ruleset={"a": 1}))
    assert registry.get("policy-1").policy_version == "policy-1"


def test_baseline_snapshot_round_trip():
    snapshot = BaselineSnapshot(
        baseline_id="baseline-1",
        captured_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
        prompt_version="v1",
        policy_version="policy-1",
        model_version="model-1",
        retrieval_version="retrieval-1",
        benchmark_version="benchmark-v1.0.0",
        evaluator_version="evaluator-v1.0.0",
        metrics={"correctness": 0.8, "grounding": 0.7},
    )
    payload = snapshot.to_dict()
    assert payload["promptVersion"] == "v1"


def test_candidate_required_fields_present():
    candidate = Candidate(
        candidate_id="c-1",
        base_prompt_version="v1",
        base_policy_version="policy-1",
        benchmark_version="benchmark-v1.0.0",
        model_version="model-1",
        evaluator_version="evaluator-v1.0.0",
        candidate_artifact="new artifact",
        training_data_version="data-1",
        candidate_metrics={"correctness": 0.85},
        baseline_metrics={"correctness": 0.8},
        failure_modes_targeted=["WRONG_ANSWER"],
    )
    assert candidate.candidate_id == "c-1"
    assert candidate.base_prompt_version == "v1"


def test_failure_miner_clusters_by_category():
    miner = FailureMiner(min_cluster_size=2)
    for i in range(3):
        miner.record(
            FailureEpisode(
                failure_id=f"f-{i}",
                episode_id=f"e-{i}",
                category=FailureCategory.WRONG_ANSWER,
                scenario_id=f"s-{i}",
                dimension="correctness",
                snippet=f"wrong answer {i}",
            )
        )
    for i in range(2):
        miner.record(
            FailureEpisode(
                failure_id=f"g-{i}",
                episode_id=f"h-{i}",
                category=FailureCategory.HALLUCINATION,
                scenario_id=f"t-{i}",
                dimension="grounding",
                snippet=f"hallucinated {i}",
            )
        )
    clusters = miner.cluster()
    categories = {c.category for c in clusters}
    assert FailureCategory.WRONG_ANSWER in categories
    assert FailureCategory.HALLUCINATION in categories
    wrong_answer_cluster = next(c for c in clusters if c.category is FailureCategory.WRONG_ANSWER)
    assert wrong_answer_cluster.count == 3


def test_failure_miner_below_threshold_not_reported():
    miner = FailureMiner(min_cluster_size=3)
    miner.record(
        FailureEpisode(
            failure_id="f-1",
            episode_id="e-1",
            category=FailureCategory.WRONG_ANSWER,
            scenario_id="s-1",
            dimension="correctness",
            snippet="x",
        )
    )
    assert miner.cluster() == []


def test_acceptance_gate_all_dimensions_pass_accepts():
    gate = AcceptanceGate()
    decision = gate.evaluate(
        candidate_id="c-1",
        baseline_metrics={
            "correctness": 0.7,
            "grounding": 0.7,
            "pedagogy": 0.7,
            "personalization": 0.7,
            "hallucination_rate": 0.1,
        },
        candidate_metrics={
            "correctness": 0.75,
            "grounding": 0.72,
            "pedagogy": 0.78,
            "personalization": 0.71,
            "hallucination_rate": 0.09,
        },
        latency_p95_ms_baseline=1000,
        latency_p95_ms_candidate=1050,
        cost_per_1k_baseline=0.10,
        cost_per_1k_candidate=0.11,
    )
    assert decision.accepted


def test_acceptance_gate_single_regression_rejects():
    gate = AcceptanceGate()
    decision = gate.evaluate(
        candidate_id="c-1",
        baseline_metrics={
            "correctness": 0.7,
            "grounding": 0.7,
            "pedagogy": 0.7,
            "personalization": 0.7,
            "hallucination_rate": 0.1,
        },
        candidate_metrics={
            "correctness": 0.7,
            "grounding": 0.7,
            "pedagogy": 0.7,
            "personalization": 0.6,
            "hallucination_rate": 0.1,
        },
        latency_p95_ms_baseline=1000,
        latency_p95_ms_candidate=1000,
        cost_per_1k_baseline=0.10,
        cost_per_1k_candidate=0.10,
    )
    assert not decision.accepted
    assert "personalization" in decision.failed_dimensions


def test_acceptance_gate_hallucination_5pct_tolerance_rejects_above():
    gate = AcceptanceGate()
    decision = gate.evaluate(
        candidate_id="c-1",
        baseline_metrics={
            "correctness": 0.7,
            "grounding": 0.7,
            "pedagogy": 0.7,
            "personalization": 0.7,
            "hallucination_rate": 0.10,
        },
        candidate_metrics={
            "correctness": 0.7,
            "grounding": 0.7,
            "pedagogy": 0.7,
            "personalization": 0.7,
            "hallucination_rate": 0.16,
        },
        latency_p95_ms_baseline=1000,
        latency_p95_ms_candidate=1000,
        cost_per_1k_baseline=0.10,
        cost_per_1k_candidate=0.10,
    )
    assert not decision.accepted


def test_acceptance_gate_latency_10pct_tolerance_rejects_above():
    gate = AcceptanceGate()
    decision = gate.evaluate(
        candidate_id="c-1",
        baseline_metrics={
            "correctness": 0.7,
            "grounding": 0.7,
            "pedagogy": 0.7,
            "personalization": 0.7,
            "hallucination_rate": 0.1,
        },
        candidate_metrics={
            "correctness": 0.7,
            "grounding": 0.7,
            "pedagogy": 0.7,
            "personalization": 0.7,
            "hallucination_rate": 0.1,
        },
        latency_p95_ms_baseline=1000,
        latency_p95_ms_candidate=1200,
        cost_per_1k_baseline=0.10,
        cost_per_1k_candidate=0.10,
    )
    assert not decision.accepted


def test_acceptance_gate_cost_20pct_tolerance_rejects_above():
    gate = AcceptanceGate()
    decision = gate.evaluate(
        candidate_id="c-1",
        baseline_metrics={
            "correctness": 0.7,
            "grounding": 0.7,
            "pedagogy": 0.7,
            "personalization": 0.7,
            "hallucination_rate": 0.1,
        },
        candidate_metrics={
            "correctness": 0.7,
            "grounding": 0.7,
            "pedagogy": 0.7,
            "personalization": 0.7,
            "hallucination_rate": 0.1,
        },
        latency_p95_ms_baseline=1000,
        latency_p95_ms_candidate=1000,
        cost_per_1k_baseline=0.10,
        cost_per_1k_candidate=0.13,
    )
    assert not decision.accepted


def test_human_approval_starts_pending():
    registry = HumanApprovalRegistry()
    approval = registry.submit("c-1")
    assert approval.status is ApprovalStatus.PENDING
    assert not registry.is_approved("c-1")


def test_human_approval_marks_approved_when_human_decides():
    registry = HumanApprovalRegistry()
    registry.submit("c-1")
    approval = registry.approve("c-1", decided_by="alice@human", rationale="ok")
    assert approval.status is ApprovalStatus.APPROVED
    assert approval.decided_by == "alice@human"


def test_human_approval_rejects_double_decision():
    registry = HumanApprovalRegistry()
    registry.submit("c-1")
    registry.approve("c-1", decided_by="alice")
    with pytest.raises(ValueError):
        registry.approve("c-1", decided_by="bob")


def test_human_approval_requires_non_empty_decided_by():
    registry = HumanApprovalRegistry()
    registry.submit("c-1")
    with pytest.raises(ValueError):
        registry.approve("c-1", decided_by="")


def test_canary_splitter_default_95_5_with_seed():
    splitter = CanarySplitter(candidate_ratio=0.05)
    decision = splitter.decide("c-1", sample_size=1000, seed=42)
    assert decision.candidate_count <= 100
    assert decision.active_count >= 900


def test_canary_splitter_zero_candidate_ratio():
    splitter = CanarySplitter(candidate_ratio=0.0)
    decision = splitter.decide("c-1", sample_size=100, seed=1)
    assert decision.candidate_count == 0
    assert decision.active_count == 100


def test_canary_splitter_rejects_invalid_ratio():
    with pytest.raises(ValueError):
        CanarySplitter(candidate_ratio=1.5)


def test_canary_splitter_rejects_non_positive_sample_size():
    splitter = CanarySplitter()
    with pytest.raises(ValueError):
        splitter.decide("c-1", sample_size=0)


def test_rollback_detects_regression_within_one_hour():
    from datetime import datetime, timedelta, timezone

    manager = RollbackManager()
    manager.start_deployment("c-1")
    event = manager.detect_regression(
        candidate_id="c-1",
        baseline_metrics={"correctness": 0.8, "_baseline_prompt_version": "v0"},
        current_metrics={"correctness": 0.6},
        now=datetime.now(timezone.utc) + timedelta(minutes=10),
    )
    assert event is not None
    assert event.regression_dimension == "correctness"


def test_rollback_ignores_regression_after_one_hour():
    from datetime import datetime, timedelta, timezone

    manager = RollbackManager()
    manager.start_deployment("c-1")
    event = manager.detect_regression(
        candidate_id="c-1",
        baseline_metrics={"correctness": 0.8},
        current_metrics={"correctness": 0.6},
        now=datetime.now(timezone.utc) + timedelta(hours=2),
    )
    assert event is None


def test_rollback_records_event_in_history():
    from datetime import datetime, timedelta, timezone

    manager = RollbackManager()
    manager.start_deployment("c-1")
    manager.detect_regression(
        candidate_id="c-1",
        baseline_metrics={"correctness": 0.8},
        current_metrics={"correctness": 0.6},
        now=datetime.now(timezone.utc) + timedelta(minutes=5),
    )
    assert len(manager.history) == 1


def test_safety_boundary_guard_lists_all_categories():
    assert len(PROTECTED_CATEGORIES) == 9


def test_safety_boundary_guard_passes_safe_change():
    guard = SafetyBoundaryGuard()
    assert guard.check("tutor prompt says be concise") == []


def test_safety_boundary_guard_blocks_authorization_change():
    guard = SafetyBoundaryGuard()
    violations = guard.check("modify @Roles('admin') for tutor prompt")
    assert any(v.category is ProtectedCategory.AUTHORIZATION for v in violations)


def test_safety_boundary_guard_blocks_financial_rules_change():
    guard = SafetyBoundaryGuard()
    violations = guard.check("patch validate_journal_entry for finance flow")
    assert any(v.category is ProtectedCategory.FINANCIAL_RULES for v in violations)


def test_safety_boundary_guard_blocks_accounting_engine_change():
    guard = SafetyBoundaryGuard()
    violations = guard.check("rewrite JournalBalanceValidator")
    assert any(v.category is ProtectedCategory.ACCOUNTING_ENGINE for v in violations)


def test_safety_boundary_guard_blocks_evaluation_benchmark_change():
    guard = SafetyBoundaryGuard()
    violations = guard.check("mutate BENCHMARK_SCENARIOS")
    assert any(v.category is ProtectedCategory.EVALUATION_BENCHMARK for v in violations)


def test_safety_boundary_guard_blocks_security_guard_change():
    guard = SafetyBoundaryGuard()
    violations = guard.check("patch InternalServiceGuard signature")
    assert any(v.category is ProtectedCategory.SECURITY_GUARDS for v in violations)


def test_safety_boundary_guard_blocks_memory_isolation_change():
    guard = SafetyBoundaryGuard()
    violations = guard.check("drop learner_id filter in tool_semantic_search")
    assert any(v.category is ProtectedCategory.MEMORY_ISOLATION for v in violations)


def test_safety_boundary_guard_blocks_tenant_isolation_change():
    guard = SafetyBoundaryGuard()
    violations = guard.check("skip tenant_id filter on cross-tenant lookup")
    assert any(v.category is ProtectedCategory.TENANT_ISOLATION for v in violations)


def test_safety_boundary_guard_blocks_system_policy_change():
    guard = SafetyBoundaryGuard()
    violations = guard.check("rewrite render_system_policy")
    assert any(v.category is ProtectedCategory.SYSTEM_POLICY for v in violations)


def test_safety_boundary_guard_blocks_educational_safety_policy_change():
    guard = SafetyBoundaryGuard()
    violations = guard.check("edit render_educational_policy for compliance")
    assert any(v.category is ProtectedCategory.EDUCATIONAL_SAFETY_POLICY for v in violations)


def test_safety_boundary_guard_assert_safe_raises():
    guard = SafetyBoundaryGuard()
    with pytest.raises(SafetyViolation):
        guard.assert_safe("rewrite @Roles guard for tutor prompt")


def test_safety_boundary_guard_assert_safe_passes_for_clean_change():
    guard = SafetyBoundaryGuard()
    guard.assert_safe("clarify the prompt to add a hint about example steps")