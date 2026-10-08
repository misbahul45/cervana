from __future__ import annotations

from v1.domain.misconception import Misconception, MisconceptionType
from v1.learner_model import (
    AdaptivePolicyService,
    LearnerState,
    SessionStage,
    check_invariants,
)


def _state(
    *,
    stage=SessionStage.INSTRUCTION,
    hint_dependency=0.0,
    difficulty_tolerance=0.5,
    concept_score=None,
    misconception_count=0,
) -> LearnerState:
    state = LearnerState(learner_id="test")
    state.current_stage = stage
    state.hint_dependency = hint_dependency
    state.difficulty_tolerance = difficulty_tolerance
    if concept_score is not None:
        mastery = state.get_mastery("double_entry")
        mastery.score = concept_score
        mastery.confidence = concept_score
        mastery.evidence_count = 5
    for i in range(misconception_count):
        ms = Misconception(
            misconception_id=f"m{i}",
            concept_id="double_entry",
            type=MisconceptionType.OTHER,
            confidence=0.7,
            evidence_count=3,
        )
        state.misconceptions.propose(ms)
    return state


def test_low_mastery_with_insufficient_evidence_uses_high_scaffolding():
    policy = AdaptivePolicyService()
    state = _state(concept_score=0.2)
    state.get_mastery("double_entry").evidence_count = 0
    strategy = policy.select(state, "double_entry")
    assert strategy.scaffolding.value == "HIGH"
    assert "LOW_MASTERY" in strategy.reason_codes
    assert "INSUFFICIENT_EVIDENCE" in strategy.reason_codes


def test_low_mastery_with_evidence_uses_medium_scaffolding():
    policy = AdaptivePolicyService()
    state = _state(concept_score=0.2)
    strategy = policy.select(state, "double_entry")
    assert strategy.scaffolding.value == "MEDIUM"
    assert "LOW_MASTERY" in strategy.reason_codes


def test_high_mastery_increases_challenge():
    policy = AdaptivePolicyService()
    state = _state(concept_score=0.9)
    strategy = policy.select(state, "double_entry")
    assert strategy.strategy.value in {"CHALLENGE", "SPACED_REVIEW"}
    assert "HIGH_MASTERY" in strategy.reason_codes


def test_misconception_promotes_to_misconception_repair():
    policy = AdaptivePolicyService()
    state = _state(misconception_count=2)
    strategy = policy.select(state, "double_entry")
    assert strategy.strategy.value == "MISCONCEPTION_REPAIR"
    assert strategy.scaffolding.value == "HIGH"
    assert "OPEN_MISCONCEPTION" in strategy.reason_codes


def test_high_hint_dependency_keeps_hint_dependency_low_with_minimal_policy():
    policy = AdaptivePolicyService()
    state = _state(hint_dependency=0.7)
    strategy = policy.select(state, "double_entry")
    assert strategy.hint_policy.value == "MINIMAL"


def test_onboarding_sets_proactive_hint_policy():
    policy = AdaptivePolicyService()
    state = _state(stage=SessionStage.ONBOARDING)
    strategy = policy.select(state, "double_entry")
    assert strategy.hint_policy.value == "PROACTIVE"


def test_insufficient_evidence_recorded():
    policy = AdaptivePolicyService()
    state = _state()
    strategy = policy.select(state, "never_seen_concept")
    assert "INSUFFICIENT_EVIDENCE" in strategy.reason_codes


def test_off_topic_does_not_change_mastery_no_policy_pollution():
    from v1.learner_model import LearningEvent, MasteryChangeKind
    from datetime import datetime, timezone

    policy = AdaptivePolicyService()
    state = _state(concept_score=0.5)
    mastery_before = state.get_mastery("double_entry").score
    state.record_event(
        LearningEvent(
            event_id="e1",
            learner_id="test",
            trace_id="t",
            concept_id="unrelated_topic",
            kind=MasteryChangeKind.OFF_TOPIC,
            occurred_at=datetime.now(timezone.utc),
        )
    )
    policy.select(state, "double_entry")
    assert state.get_mastery("double_entry").score == mastery_before


def test_policy_invariants_property_holds_for_strategies():
    policy = AdaptivePolicyService()
    fixtures = []
    for score in [0.0, 0.25, 0.5, 0.75, 0.9, 1.0]:
        for hd in [0.0, 0.3, 0.6, 0.9]:
            for mc in range(0, 4):
                fixtures.append((score, hd, mc))
    for score, hd, mc in fixtures:
        state = _state(concept_score=score, hint_dependency=hd, misconception_count=mc)
        strategy = policy.select(state, "double_entry")
        assert check_invariants(strategy) == []


def test_preference_confidence_increases_with_evidence_and_decays():
    from v1.learner_model import Preference, PreferenceKey, PreferenceSource

    p = Preference(
        preference_key=PreferenceKey.EXPLANATION_STYLE,
        value="WORKED_EXAMPLE",
        source=PreferenceSource.OBSERVED,
        confidence=0.4,
        evidence_count=2,
    )
    reinforced = p.reinforce(additional=4)
    assert reinforced.confidence > p.confidence
    decayed = reinforced.decay(0.5)
    assert decayed.confidence < reinforced.confidence


def test_old_low_confidence_preference_decays_more_than_recent():
    from datetime import datetime, timedelta, timezone
    from v1.learner_model import Preference, PreferenceKey, PreferenceSource

    old = Preference(
        preference_key=PreferenceKey.PACING,
        value="SLOW",
        source=PreferenceSource.OBSERVED,
        confidence=0.5,
        evidence_count=2,
        last_observed_at=datetime.now(timezone.utc) - timedelta(days=60),
    )
    recent = Preference(
        preference_key=PreferenceKey.PACING,
        value="SLOW",
        source=PreferenceSource.OBSERVED,
        confidence=0.5,
        evidence_count=2,
        last_observed_at=datetime.now(timezone.utc),
    )
    assert old.decay(0.1).confidence < recent.decay(0.1).confidence


def test_policy_is_deterministic_for_same_input():
    policy = AdaptivePolicyService()
    state_a = _state(concept_score=0.5)
    state_b = _state(concept_score=0.5)
    sa = policy.select(state_a, "double_entry")
    sb = policy.select(state_b, "double_entry")
    assert sa.to_dict() == sb.to_dict()