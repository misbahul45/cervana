from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

from v1.domain.misconception import MisconceptionStatus
from v1.learner_model.events import LearningEvent, MasteryChangeKind
from v1.learner_model.misconception import MisconceptionPipeline
from v1.learner_model.state import ConceptMastery, LearnerState


DEFAULT_ELO_K = 24.0
DEFAULT_LEARNING_RATE = 0.20
DEFAULT_DECAY = 0.97
HINT_DAMPING = 0.6


@dataclass(frozen=True)
class MasteryDelta:
    concept_id: str
    score_before: float
    score_after: float
    confidence_before: float
    confidence_after: float
    evidence_count: int
    reason_code: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "conceptId": self.concept_id,
            "scoreBefore": self.score_before,
            "scoreAfter": self.score_after,
            "confidenceBefore": self.confidence_before,
            "confidenceAfter": self.confidence_after,
            "evidenceCount": self.evidence_count,
            "reasonCode": self.reason_code,
        }


@dataclass(frozen=True)
class MasteryUpdate:
    deltas: List[MasteryDelta] = field(default_factory=list)
    events: List[LearningEvent] = field(default_factory=list)
    reason_codes: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "deltas": [d.to_dict() for d in self.deltas],
            "eventCount": len(self.events),
            "reasonCodes": list(self.reason_codes),
        }


class MasteryService:
    def __init__(
        self,
        *,
        elo_k: float = DEFAULT_ELO_K,
        learning_rate: float = DEFAULT_LEARNING_RATE,
        decay: float = DEFAULT_DECAY,
    ) -> None:
        if elo_k <= 0:
            raise ValueError("elo_k must be positive")
        if not (0 < learning_rate <= 1):
            raise ValueError("learning_rate must be in (0, 1]")
        if not (0 < decay <= 1):
            raise ValueError("decay must be in (0, 1]")
        self.elo_k = elo_k
        self.learning_rate = learning_rate
        self.decay = decay

    def expected_score(self, learner_mastery: float) -> float:
        return 1.0 / (1.0 + math.exp(-learner_mastery * 12.0 + 6.0))

    def delta_for(self, observed: bool, learner_mastery: float, hint_level: int = 0) -> float:
        expected = self.expected_score(learner_mastery)
        actual = 1.0 if observed else 0.0
        raw = self.elo_k * (actual - expected)
        if hint_level > 0:
            raw *= HINT_DAMPING ** hint_level
        return raw / 400.0

    def confidence_delta_for(self, evidence_count: int, hint_level: int = 0) -> float:
        base = self.learning_rate * math.log1p(evidence_count + 1) / math.log1p(11)
        if hint_level > 0:
            base *= HINT_DAMPING ** hint_level
        return min(0.9, max(0.0, base))

    def apply_event(
        self,
        state: LearnerState,
        event: LearningEvent,
    ) -> MasteryUpdate:
        mastery = state.get_mastery(event.concept_id)
        before = mastery.score
        before_confidence = mastery.confidence

        if event.kind == MasteryChangeKind.OFF_TOPIC:
            reason = "OFF_TOPIC_NO_MASTERY_CHANGE"
            after = before
            after_confidence = before_confidence
            mastery.evidence_count += 1
        elif event.kind == MasteryChangeKind.CORRECT_ANSWER:
            delta = self.delta_for(True, before, event.hint_level)
            after = min(1.0, before + delta)
            after_confidence = min(1.0, before_confidence + self.confidence_delta_for(mastery.evidence_count, event.hint_level))
            mastery.evidence_count += 1
            reason = "CORRECT_ANSWER"
        elif event.kind == MasteryChangeKind.INCORRECT_ANSWER:
            delta = self.delta_for(False, before, event.hint_level)
            after = max(0.0, before + delta)
            after_confidence = max(0.0, before_confidence - 0.05)
            mastery.evidence_count += 1
            state.error_patterns[event.concept_id] = state.error_patterns.get(event.concept_id, 0) + 1
            reason = "INCORRECT_ANSWER"
        elif event.kind == MasteryChangeKind.HINT_USED:
            after = before
            after_confidence = before_confidence
            mastery.evidence_count += 1
            state.hint_dependency = min(1.0, state.hint_dependency + 0.1)
            reason = "HINT_USED"
        elif event.kind == MasteryChangeKind.MISCONCEPTION_RESOLVED:
            after = min(1.0, before + 0.15)
            after_confidence = min(1.0, before_confidence + 0.1)
            mastery.evidence_count += 1
            reason = "MISCONCEPTION_RESOLVED"
        else:
            after = before
            after_confidence = before_confidence
            mastery.evidence_count += 1
            reason = "UNKNOWN_KIND"

        mastery.score = after
        mastery.confidence = after_confidence
        mastery.last_updated_at = datetime.now(timezone.utc)

        state.record_event(event)
        delta = MasteryDelta(
            concept_id=event.concept_id,
            score_before=before,
            score_after=after,
            confidence_before=before_confidence,
            confidence_after=after_confidence,
            evidence_count=mastery.evidence_count,
            reason_code=reason,
        )
        return MasteryUpdate(deltas=[delta], events=[event], reason_codes=[reason])

    def apply_many(
        self,
        state: LearnerState,
        events: Iterable[LearningEvent],
    ) -> MasteryUpdate:
        deltas: List[MasteryDelta] = []
        collected: List[LearningEvent] = []
        reasons: List[str] = []
        for event in events:
            update = self.apply_event(state, event)
            deltas.extend(update.deltas)
            collected.extend(update.events)
            reasons.extend(update.reason_codes)
        return MasteryUpdate(deltas=deltas, events=collected, reason_codes=reasons)


GOLDEN_VECTORS: List[Dict[str, Any]] = [
    {
        "name": "G01_correct_answer_increases_mastery",
        "input": {"kind": MasteryChangeKind.CORRECT_ANSWER, "concept": "double_entry", "hint_level": 0},
        "expect": {"score_delta_positive": True, "confidence_delta_positive": True},
    },
    {
        "name": "G02_incorrect_answer_decreases_mastery",
        "input": {"kind": MasteryChangeKind.INCORRECT_ANSWER, "concept": "double_entry", "hint_level": 0},
        "expect": {"score_delta_positive": False, "confidence_delta_positive": False},
    },
    {
        "name": "G03_hint_used_does_not_increase_mastery",
        "input": {"kind": MasteryChangeKind.HINT_USED, "concept": "double_entry", "hint_level": 1},
        "expect": {"score_delta_zero": True, "hint_dependency_increases": True},
    },
    {
        "name": "G04_off_topic_does_not_change_mastery",
        "input": {"kind": MasteryChangeKind.OFF_TOPIC, "concept": "double_entry", "hint_level": 0},
        "expect": {"score_unchanged": True, "confidence_unchanged": True},
    },
    {
        "name": "G05_misconception_resolution_increases_confidence",
        "input": {"kind": MasteryChangeKind.MISCONCEPTION_RESOLVED, "concept": "contra_account", "hint_level": 0},
        "expect": {"confidence_delta_positive": True, "score_delta_positive": True},
    },
    {
        "name": "G06_mastery_is_bounded_in_0_1",
        "input": {"kind": MasteryChangeKind.CORRECT_ANSWER, "concept": "journal_entry", "hint_level": 0, "start_score": 0.95, "events": 10},
        "expect": {"max_score": 1.0},
    },
    {
        "name": "G07_hint_dampens_correct_delta",
        "input": {"kind": MasteryChangeKind.CORRECT_ANSWER, "concept": "double_entry", "hint_level": 0},
        "compare_with": {"kind": MasteryChangeKind.CORRECT_ANSWER, "concept": "double_entry", "hint_level": 3},
        "expect": {"first_delta_greater_than_second": True},
    },
    {
        "name": "G08_repeated_incorrect_drives_mastery_toward_zero",
        "input": {"kind": MasteryChangeKind.INCORRECT_ANSWER, "concept": "normal_balance", "hint_level": 0, "events": 50, "start_score": 0.5},
        "expect": {"score_below_or_equal_start": True},
    },
]


def run_golden_vectors(service: Optional[MasteryService] = None) -> List[Tuple[str, bool]]:
    service = service or MasteryService()
    results: List[Tuple[str, bool]] = []
    for vector in GOLDEN_VECTORS:
        passed = _evaluate_golden_vector(service, vector)
        results.append((vector["name"], passed))
    return results


def _evaluate_golden_vector(service: MasteryService, vector: Dict[str, Any]) -> bool:
    from v1.learner_model.events import LearningEvent

    inp = vector["input"]
    start_score = inp.get("start_score", 0.5)
    start_state = LearnerState(learner_id="test")
    mastery = start_state.get_mastery(inp["concept"])
    mastery.score = start_score
    mastery.confidence = 0.5

    repeat = inp.get("events", 1)
    last_delta = None
    for _ in range(repeat):
        event = LearningEvent(
            event_id="e",
            learner_id="test",
            trace_id="trace",
            concept_id=inp["concept"],
            kind=inp["kind"],
            occurred_at=datetime.now(timezone.utc),
            hint_level=inp.get("hint_level", 0),
        )
        update = service.apply_event(start_state, event)
        if update.deltas:
            last_delta = update.deltas[0]

    expect = vector["expect"]
    if last_delta is None and "score_unchanged" in expect:
        return True
    if last_delta is None:
        return False

    if expect.get("score_delta_positive") is True:
        if not (last_delta.score_after > last_delta.score_before):
            return False
    if expect.get("score_delta_positive") is False:
        if not (last_delta.score_after <= last_delta.score_before):
            return False
    if expect.get("score_delta_zero"):
        if last_delta.score_after != last_delta.score_before:
            return False
    if expect.get("score_unchanged") and last_delta.score_after != start_score:
        return False
    if expect.get("confidence_unchanged") and last_delta.confidence_after != 0.5:
        return False
    if expect.get("confidence_delta_positive") is True:
        if not (last_delta.confidence_after >= last_delta.confidence_before):
            return False
    if expect.get("confidence_delta_positive") is False:
        if not (last_delta.confidence_after <= last_delta.confidence_before):
            return False
    if expect.get("max_score") is not None:
        if last_delta.score_after > expect["max_score"]:
            return False
    if expect.get("score_below_or_equal_start") is True:
        if last_delta.score_after > start_score:
            return False
    if expect.get("hint_dependency_increases") is True:
        if start_state.hint_dependency <= 0:
            return False

    if "compare_with" in vector:
        compare = vector["compare_with"]
        compare_event = LearningEvent(
            event_id="e2",
            learner_id="test",
            trace_id="trace",
            concept_id=compare["concept"],
            kind=compare["kind"],
            occurred_at=datetime.now(timezone.utc),
            hint_level=compare.get("hint_level", 0),
        )
        compare_state = LearnerState(learner_id="test")
        compare_mastery = compare_state.get_mastery(compare["concept"])
        compare_mastery.score = 0.5
        compare_mastery.confidence = 0.5
        compare_update = service.apply_event(compare_state, compare_event)
        compare_delta = compare_update.deltas[0]
        if expect.get("first_delta_greater_than_second"):
            first = last_delta.score_after - last_delta.score_before
            second = compare_delta.score_after - compare_delta.score_before
            if first <= second:
                return False

    return True


__all__ = [
    "MasteryDelta",
    "MasteryUpdate",
    "MasteryService",
    "GOLDEN_VECTORS",
    "run_golden_vectors",
    "DEFAULT_ELO_K",
    "DEFAULT_LEARNING_RATE",
    "DEFAULT_DECAY",
    "HINT_DAMPING",
]