from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, List, Optional

from v1.learner_model.state import ConceptMastery, LearnerState, SessionStage


class StrategyName(str, Enum):
    DIRECT_EXPLANATION = "DIRECT_EXPLANATION"
    SOCRATIC = "SOCRATIC"
    GUIDED_STEP_BY_STEP = "GUIDED_STEP_BY_STEP"
    ERROR_ANALYSIS = "ERROR_ANALYSIS"
    CONCEPT_COMPARISON = "CONCEPT_COMPARISON"
    WORKED_EXAMPLE = "WORKED_EXAMPLE"
    COUNTEREXAMPLE = "COUNTEREXAMPLE"
    RETRIEVAL_PRACTICE = "RETRIEVAL_PRACTICE"
    SPACED_REVIEW = "SPACED_REVIEW"
    MISCONCEPTION_REPAIR = "MISCONCEPTION_REPAIR"
    SCAFFOLDING = "SCAFFOLDING"
    CHALLENGE = "CHALLENGE"
    REFLECTION = "REFLECTION"


class ScaffoldingLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class HintPolicy(str, Enum):
    MINIMAL = "MINIMAL"
    SCAFFOLDED = "SCAFFOLDED"
    PROACTIVE = "PROACTIVE"


POLICY_VERSION = "v1.0.0"


@dataclass(frozen=True)
class AdaptiveStrategy:
    mode: str
    strategy: StrategyName
    difficulty: float
    hint_level: int
    hint_policy: HintPolicy
    scaffolding: ScaffoldingLevel
    reason_codes: List[str] = field(default_factory=list)
    policy_version: str = POLICY_VERSION
    next_action: Optional[dict] = None

    def to_dict(self) -> dict:
        return {
            "mode": self.mode,
            "strategy": self.strategy.value,
            "difficulty": self.difficulty,
            "hintLevel": self.hint_level,
            "hintPolicy": self.hint_policy.value,
            "scaffolding": self.scaffolding.value,
            "reasonCodes": list(self.reason_codes),
            "policyVersion": self.policy_version,
            "nextAction": self.next_action,
        }


def _clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


def _select_strategy(state: LearnerState, concept_id: str) -> StrategyName:
    mastery = state.concept_mastery.get(concept_id)
    misconceptions = state.misconceptions.all_for_concept(concept_id)

    if misconceptions:
        return StrategyName.MISCONCEPTION_REPAIR
    if mastery is None:
        return StrategyName.DIRECT_EXPLANATION
    if mastery.score < 0.3:
        return StrategyName.GUIDED_STEP_BY_STEP
    if mastery.score < 0.55:
        return StrategyName.WORKED_EXAMPLE
    if mastery.score < 0.75:
        return StrategyName.RETRIEVAL_PRACTICE
    if mastery.score < 0.9:
        return StrategyName.CHALLENGE
    return StrategyName.SPACED_REVIEW


def _select_scaffolding(state: LearnerState, concept_id: str, mastery: Optional[ConceptMastery]) -> ScaffoldingLevel:
    misconceptions = state.misconceptions.all_for_concept(concept_id)
    if misconceptions:
        return ScaffoldingLevel.HIGH
    if mastery is None or mastery.evidence_count < 3:
        return ScaffoldingLevel.HIGH
    if state.hint_dependency > 0.6:
        return ScaffoldingLevel.HIGH
    if mastery.score < 0.6:
        return ScaffoldingLevel.MEDIUM
    return ScaffoldingLevel.LOW


def _select_hint_level(mastery: Optional[ConceptMastery], scaffolding: ScaffoldingLevel) -> int:
    if scaffolding == ScaffoldingLevel.HIGH:
        return min(3, max(0, int((1.0 - (mastery.score if mastery else 0.0)) * 3)))
    if scaffolding == ScaffoldingLevel.MEDIUM:
        return 2 if (mastery is None or mastery.score < 0.4) else 1
    return 1 if (mastery is None or mastery.score < 0.5) else 0


def _select_difficulty(mastery: Optional[ConceptMastery], hint_level: int) -> float:
    if mastery is None:
        base = 0.3
    else:
        base = mastery.score
    delta = hint_level * 0.05
    return _clamp(base - delta)


def _select_mode(state: LearnerState) -> str:
    misconceptions_total = sum(
        1
        for t in state.misconceptions._tracked.values()
        if t.stage.value == "CONFIRMED" or t.stage.value == "PERSISTENT"
    )
    if state.current_stage == SessionStage.ONBOARDING:
        return "EXPLAIN"
    if misconceptions_total > 0:
        return "REMEDIATION"
    if state.current_stage == SessionStage.REVIEW:
        return "REVIEW"
    if state.current_stage == SessionStage.PRACTICE:
        return "PRACTICE"
    return "LEARN"


class AdaptivePolicyService:
    def __init__(self, policy_version: str = POLICY_VERSION) -> None:
        self.policy_version = policy_version

    def select(
        self,
        state: LearnerState,
        concept_id: str,
    ) -> AdaptiveStrategy:
        if not (0.0 <= state.difficulty_tolerance <= 1.0):
            raise ValueError("difficulty_tolerance must be in [0, 1]")
        if state.hint_dependency < 0.0 or state.hint_dependency > 1.0:
            raise ValueError("hint_dependency must be in [0, 1]")

        mastery = state.concept_mastery.get(concept_id)
        if mastery is not None and not (0.0 <= mastery.score <= 1.0):
            raise ValueError(f"mastery.score out of range for {concept_id}")

        misconceptions = state.misconceptions.all_for_concept(concept_id)
        reason_codes: List[str] = []

        mode = _select_mode(state)
        strategy = _select_strategy(state, concept_id)
        scaffolding = _select_scaffolding(state, concept_id, mastery)
        hint_level = _select_hint_level(mastery, scaffolding)
        difficulty = _select_difficulty(mastery, hint_level)

        if mastery is None or mastery.evidence_count == 0:
            reason_codes.append("INSUFFICIENT_EVIDENCE")
        else:
            reason_codes.append(f"MASTERY_{int(mastery.score * 100)}")

        if mastery is not None and mastery.score < 0.55:
            reason_codes.append("LOW_MASTERY")
        elif mastery is not None and mastery.score >= 0.85:
            reason_codes.append("HIGH_MASTERY")

        if state.hint_dependency > 0.6:
            reason_codes.append("HIGH_HINT_DEPENDENCY")

        if misconceptions:
            reason_codes.append("OPEN_MISCONCEPTION")

        if scaffolding == ScaffoldingLevel.HIGH:
            reason_codes.append("HIGH_SCAFFOLDING")
        elif scaffolding == ScaffoldingLevel.LOW:
            reason_codes.append("LOW_SCAFFOLDING")

        if not (0.0 <= difficulty <= 1.0):
            reason_codes.append("DIFFICULTY_OUT_OF_RANGE")
        if not (0 <= hint_level <= 7):
            reason_codes.append("HINT_LEVEL_OUT_OF_RANGE")

        if state.current_stage == SessionStage.ONBOARDING:
            hint_policy = HintPolicy.PROACTIVE
        elif state.hint_dependency > 0.6:
            hint_policy = HintPolicy.MINIMAL
        else:
            hint_policy = HintPolicy.SCAFFOLDED

        return AdaptiveStrategy(
            mode=mode,
            strategy=strategy,
            difficulty=difficulty,
            hint_level=hint_level,
            hint_policy=hint_policy,
            scaffolding=scaffolding,
            reason_codes=reason_codes,
            policy_version=self.policy_version,
        )


PROPERTY_INVARIANTS = [
    ("difficulty_in_unit_interval", lambda s: 0.0 <= s.difficulty <= 1.0),
    ("hint_level_documented_range", lambda s: 0 <= s.hint_level <= 7),
    ("policy_version_set", lambda s: bool(s.policy_version)),
    ("reason_codes_nonempty", lambda s: len(s.reason_codes) > 0),
    ("strategy_non_null", lambda s: s.strategy is not None),
    ("mode_non_empty", lambda s: bool(s.mode)),
]


def check_invariants(strategy: AdaptiveStrategy) -> List[str]:
    failures: List[str] = []
    for name, predicate in PROPERTY_INVARIANTS:
        if not predicate(strategy):
            failures.append(name)
    return failures


__all__ = [
    "StrategyName",
    "ScaffoldingLevel",
    "HintPolicy",
    "POLICY_VERSION",
    "AdaptiveStrategy",
    "AdaptivePolicyService",
    "PROPERTY_INVARIANTS",
    "check_invariants",
]