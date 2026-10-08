from __future__ import annotations

from v1.domain.misconception import Misconception, MisconceptionType
from v1.learner_model import MisconceptionPipeline


def test_propose_concepts_per_evidence_increments_lifecycle():
    pipeline = MisconceptionPipeline()
    misconception = Misconception(
        misconception_id="m1",
        concept_id="contra_account",
        type=MisconceptionType.CONTRA_ACCOUNT_CONFUSION,
    )
    pipeline.propose(misconception)
    pipeline.propose(misconception)
    pipeline.propose(misconception)
    pipeline.propose(misconception)
    tracked = pipeline.get("m1")
    assert tracked is not None
    assert tracked.stage.value == "CONFIRMED"
    assert tracked.evidence_count == 4


def test_promote_to_means_stage_after_5_evidence():
    pipeline = MisconceptionPipeline()
    for _ in range(6):
        pipeline.propose(
            Misconception(
                misconception_id="m2",
                concept_id="normal_balance",
                type=MisconceptionType.DEBIT_CREDIT_DIRECTION_ERROR,
            )
        )
    tracked = pipeline.get("m2")
    assert tracked is not None
    assert tracked.stage.value == "PERSISTENT"


def test_resolve_marks_resolved_and_clears_from_active_set():
    pipeline = MisconceptionPipeline()
    pipeline.propose(
        Misconception(
            misconception_id="m3",
            concept_id="adjusting_entry",
            type=MisconceptionType.ADJUSTING_ENTRY_ERROR,
        )
    )
    pipeline.resolve("m3", "student explained the adjusting entry correctly")
    tracked = pipeline.get("m3")
    assert tracked is not None
    assert tracked.stage.value == "RESOLVED"
    assert pipeline.all_for_concept("adjusting_entry") == []


def test_same_misconception_id_is_idempotent():
    pipeline = MisconceptionPipeline()
    for _ in range(3):
        pipeline.propose(
            Misconception(
                misconception_id="m4",
                concept_id="contra_account",
                type=MisconceptionType.CONTRA_ACCOUNT_CONFUSION,
            )
        )
    assert pipeline.get("m4").stage.value == "CONFIRMED"
    assert pipeline.get("m4").evidence_count == 3