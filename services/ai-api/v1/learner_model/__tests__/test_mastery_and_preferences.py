from __future__ import annotations

from datetime import datetime, timezone

from v1.learner_model import (
    ConceptMastery,
    Goal,
    GoalKind,
    LearnerState,
    LearningEvent,
    MasteryChangeKind,
    MasteryService,
    Preference,
    PreferenceKey,
    PreferenceSource,
    SessionStage,
)


def _event(kind: MasteryChangeKind, concept: str = "double_entry", hint: int = 0) -> LearningEvent:
    return LearningEvent(
        event_id=f"e-{kind.value}-{hint}",
        learner_id="test",
        trace_id="t-1",
        concept_id=concept,
        kind=kind,
        occurred_at=datetime.now(timezone.utc),
        hint_level=hint,
    )


def test_correct_answer_increases_mastery_and_confidence():
    service = MasteryService()
    state = LearnerState(learner_id="test")
    update = service.apply_event(state, _event(MasteryChangeKind.CORRECT_ANSWER))
    delta = update.deltas[0]
    assert delta.score_after > delta.score_before
    assert delta.confidence_after > delta.confidence_before


def test_incorrect_answer_decreases_mastery_and_confidence():
    service = MasteryService()
    state = LearnerState(learner_id="test")
    update = service.apply_event(state, _event(MasteryChangeKind.INCORRECT_ANSWER))
    delta = update.deltas[0]
    assert delta.score_after < delta.score_before
    assert delta.confidence_after < delta.confidence_before


def test_off_topic_does_not_change_mastery():
    service = MasteryService()
    state = LearnerState(learner_id="test")
    update = service.apply_event(state, _event(MasteryChangeKind.OFF_TOPIC))
    delta = update.deltas[0]
    assert delta.score_after == delta.score_before
    assert delta.confidence_after == delta.confidence_before


def test_hint_used_does_not_increase_mastery_but_raises_hint_dependency():
    service = MasteryService()
    state = LearnerState(learner_id="test")
    update = service.apply_event(state, _event(MasteryChangeKind.HINT_USED, hint=1))
    delta = update.deltas[0]
    assert delta.score_after == delta.score_before
    assert state.hint_dependency > 0


def test_mastery_score_bounded_in_unit_interval():
    service = MasteryService()
    state = LearnerState(learner_id="test")
    for _ in range(200):
        service.apply_event(state, _event(MasteryChangeKind.CORRECT_ANSWER))
    for mastery in state.concept_mastery.values():
        assert 0.0 <= mastery.score <= 1.0


def test_hint_dampens_correct_delta():
    service = MasteryService()
    state_a = LearnerState(learner_id="a")
    state_b = LearnerState(learner_id="b")
    upd_a = service.apply_event(state_a, _event(MasteryChangeKind.CORRECT_ANSWER, hint=0))
    upd_b = service.apply_event(state_b, _event(MasteryChangeKind.CORRECT_ANSWER, hint=3))
    delta_a = upd_a.deltas[0]
    delta_b = upd_b.deltas[0]
    assert (delta_a.score_after - delta_a.score_before) > (delta_b.score_after - delta_b.score_before)


def test_misconception_resolution_increases_confidence():
    service = MasteryService()
    state = LearnerState(learner_id="test")
    mastery = state.get_mastery("contra_account")
    mastery.score = 0.4
    mastery.confidence = 0.4
    update = service.apply_event(state, _event(MasteryChangeKind.MISCONCEPTION_RESOLVED, concept="contra_account"))
    delta = update.deltas[0]
    assert delta.confidence_after > delta.confidence_before


def test_repeated_incorrect_drives_mastery_down():
    service = MasteryService()
    state = LearnerState(learner_id="test")
    mastery = state.get_mastery("normal_balance")
    mastery.score = 0.7
    for _ in range(50):
        service.apply_event(state, _event(MasteryChangeKind.INCORRECT_ANSWER, concept="normal_balance"))
    assert mastery.score < 0.7


def test_mastery_is_reproducible_for_same_event_sequence():
    service = MasteryService()
    state_a = LearnerState(learner_id="a")
    state_b = LearnerState(learner_id="b")
    events = [
        _event(MasteryChangeKind.CORRECT_ANSWER, concept="c1"),
        _event(MasteryChangeKind.INCORRECT_ANSWER, concept="c1"),
        _event(MasteryChangeKind.CORRECT_ANSWER, concept="c1", hint=1),
        _event(MasteryChangeKind.HINT_USED, concept="c2", hint=2),
    ]
    service.apply_many(state_a, events)
    service.apply_many(state_b, events)
    for cid in state_a.concept_mastery:
        a = state_a.concept_mastery[cid]
        b = state_b.concept_mastery[cid]
        assert abs(a.score - b.score) < 1e-9
        assert abs(a.confidence - b.confidence) < 1e-9


def test_all_golden_vectors_pass():
    from v1.learner_model.mastery import run_golden_vectors

    results = run_golden_vectors()
    failures = [(name, ok) for name, ok in results if not ok]
    assert not failures, f"failing golden vectors: {failures}"


def test_preference_reinforce_and_decay():
    p = Preference(
        preference_key=PreferenceKey.EXPLANATION_STYLE,
        value="WORKED_EXAMPLE",
        source=PreferenceSource.OBSERVED,
        confidence=0.5,
        evidence_count=2,
    )
    reinforced = p.reinforce(additional=2)
    assert reinforced.confidence > p.confidence
    assert reinforced.evidence_count == 4

    decayed = reinforced.decay(0.2)
    assert decayed.confidence < reinforced.confidence
    assert 0.0 <= decayed.confidence <= 1.0


def test_preference_rejects_invalid_confidence():
    import pytest

    with pytest.raises(ValueError):
        Preference(
            preference_key=PreferenceKey.EXPLANATION_STYLE,
            value="WORKED_EXAMPLE",
            source=PreferenceSource.OBSERVED,
            confidence=1.5,
        )
    with pytest.raises(ValueError):
        Preference(
            preference_key=PreferenceKey.EXPLANATION_STYLE,
            value="WORKED_EXAMPLE",
            source=PreferenceSource.OBSERVED,
            evidence_count=0,
        )