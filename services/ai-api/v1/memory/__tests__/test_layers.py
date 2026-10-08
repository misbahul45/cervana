from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

from v1.memory import (
    Episode,
    EpisodicMemory,
    MemoryCandidate,
    MemoryLayer,
    MemorySource,
    Procedure,
    ProceduralMemory,
    SemanticLearnerMemory,
    SemanticSource,
    SemanticTrait,
    WorkingMemory,
)


def _make_candidate(
    *,
    learner_id: str = "L",
    trait_key: str = "preference.explanation_style",
    value: str = "WORKED_EXAMPLE long enough to pass salience checks",
    salience: float = 0.7,
    confidence: float = 0.6,
    novelty: float = 0.6,
    recurrence_count: int = 2,
    evidence_count: int = 2,
) -> MemoryCandidate:
    return MemoryCandidate(
        candidate_id=f"c-{learner_id}-{trait_key}-{value[:5]}",
        learner_id=learner_id,
        trait_key=trait_key,
        value=value,
        source=MemorySource.OBSERVED,
        confidence=confidence,
        evidence_count=evidence_count,
        salience=salience,
        novelty=novelty,
        recurrence_count=recurrence_count,
    )


def test_working_memory_returns_same_session_object_within_call():
    layer = MemoryLayer()
    wm_a = layer.working_for("session-x", "L")
    wm_b = layer.working_for("session-x", "L")
    assert wm_a is wm_b


def test_working_memory_discarded_then_recreated_clears_scratchpad():
    layer = MemoryLayer()
    wm = layer.working_for("s1", "L")
    wm.update(scratchpad={"x": 1})
    layer.discard_working("s1")
    fresh = layer.working_for("s1", "L")
    assert fresh.scratchpad == {}


def test_semantic_upsert_keeps_higher_confidence_value_on_conflict():
    semantic = SemanticLearnerMemory()
    semantic.upsert(
        SemanticTrait(
            trait_id="t1",
            learner_id="L",
            trait_key="k",
            value="A",
            source=SemanticSource.OBSERVED,
            confidence=0.9,
            evidence_count=2,
            last_observed_at=datetime.now(timezone.utc) - timedelta(days=2),
        )
    )
    semantic.upsert(
        SemanticTrait(
            trait_id="t2",
            learner_id="L",
            trait_key="k",
            value="B",
            source=SemanticSource.INFERRED,
            confidence=0.6,
            evidence_count=1,
            last_observed_at=datetime.now(timezone.utc),
        )
    )
    recalled = semantic.recall("L", trait_key="k")
    assert recalled[0].value == "A"


def test_procedural_upsert_dedup_steps():
    pmem = ProceduralMemory()
    pmem.upsert(
        Procedure(
            procedure_id="p1",
            learner_id="L",
            name="post_journal",
            steps=["identify_accounts", "apply_normal_balance"],
            applicability=["post_journal"],
            evidence_count=1,
        )
    )
    pmem.upsert(
        Procedure(
            procedure_id="p2",
            learner_id="L",
            name="post_journal",
            steps=["identify_accounts", "post_entry"],
            applicability=["post_journal"],
            evidence_count=1,
        )
    )
    procedures = pmem.recall("L", applicability="post_journal")
    assert procedures[0].steps == ["identify_accounts", "apply_normal_balance", "post_entry"]


def test_episodic_recall_respects_limit():
    ep_memory = EpisodicMemory()
    for i in range(50):
        ep_memory.record(
            Episode(
                episode_id=f"e-{i}",
                learner_id="L",
                trace_id="t",
                task="learn",
            )
        )
    assert len(ep_memory.recall("L", limit=10)) == 10
    assert len(ep_memory) == 50


def test_isolation_under_random_users_with_random_traits():
    layer = MemoryLayer()
    rng = random.Random(20261005)
    a_id = f"user-{rng.randint(0, 9999)}"
    b_id = f"user-{rng.randint(0, 9999)}"
    a_traits = []
    for i in range(20):
        trait_key = f"trait_{rng.choice(['preference', 'style', 'pacing'])}"
        value = f"alice_marker_{i}_{rng.randint(0, 9999)} value"
        a_traits.append(value)
        layer.write_semantic(
            _make_candidate(learner_id=a_id, trait_key=trait_key, value=value)
        )
    for i in range(20):
        layer.write_semantic(
            _make_candidate(
                learner_id=b_id,
                trait_key=f"trait_{rng.choice(['preference', 'style', 'pacing'])}",
                value=f"bob_value_{i}",
            )
        )
    report = layer.cross_learner_audit(
        learner_a_id=a_id,
        learner_b_id=b_id,
        learner_a_traits=a_traits,
    )
    assert not report.leaked