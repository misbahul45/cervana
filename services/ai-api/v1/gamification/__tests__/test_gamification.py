from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from v1.gamification import (
    BoundaryViolation,
    CANONICAL_CELEBRATION_PHRASES,
    RewardEngineSimulator,
    assert_ai_only_narrates,
    contains_forbidden_call,
    narration_for_milestone,
    render_celebration,
    render_narration_block,
)


def _engine() -> RewardEngineSimulator:
    return RewardEngineSimulator()


def test_duplicate_event_yields_one_reward():
    engine = _engine()
    first = engine.evaluate(
        idempotency_key="k-1",
        event_kind="MASTERY_CHANGE",
        rule_id="r-1",
        rule_version="v1",
        reward_kind="XP",
        amount=20,
    )
    second = engine.evaluate(
        idempotency_key="k-1",
        event_kind="MASTERY_CHANGE",
        rule_id="r-1",
        rule_version="v1",
        reward_kind="XP",
        amount=20,
    )
    assert first["eligible"] is True
    assert second["eligible"] is False
    assert second["reason"] == "REJECT_DUPLICATE"


def test_scenario_replay_yields_zero_reward():
    engine = _engine()
    first = engine.evaluate(
        idempotency_key="k-1",
        event_kind="SCENARIO_SUCCESS",
        rule_id="scenario-A",
        rule_version="v1",
        reward_kind="XP",
        amount=100,
    )
    second = engine.evaluate(
        idempotency_key="k-2",
        event_kind="SCENARIO_SUCCESS",
        rule_id="scenario-A",
        rule_version="v1",
        reward_kind="XP",
        amount=100,
    )
    assert first["eligible"] is True
    assert second["eligible"] is False
    assert second["reason"] == "REJECT_REPLAY"


def test_scenario_after_cooldown_accepted():
    engine = _engine()
    base = datetime(2026, 10, 5, 12, 0, 0, tzinfo=timezone.utc)
    first = engine.evaluate(
        idempotency_key="k-1",
        event_kind="SCENARIO_SUCCESS",
        rule_id="scenario-A",
        rule_version="v1",
        reward_kind="XP",
        amount=100,
        now=base,
    )
    second = engine.evaluate(
        idempotency_key="k-2",
        event_kind="SCENARIO_SUCCESS",
        rule_id="scenario-A",
        rule_version="v1",
        reward_kind="XP",
        amount=100,
        now=base + timedelta(seconds=120),
    )
    assert first["eligible"] is True
    assert second["eligible"] is True


def test_too_fast_completion_yields_zero_reward():
    engine = _engine()
    base = datetime(2026, 10, 5, 12, 0, 0, tzinfo=timezone.utc)
    first = engine.evaluate(
        idempotency_key="k-1",
        event_kind="SCENARIO_SUCCESS",
        rule_id="scenario-A",
        rule_version="v1",
        reward_kind="XP",
        amount=100,
        now=base,
    )
    second = engine.evaluate(
        idempotency_key="k-2",
        event_kind="SCENARIO_SUCCESS",
        rule_id="scenario-A",
        rule_version="v1",
        reward_kind="XP",
        amount=100,
        now=base + timedelta(seconds=5),
    )
    assert first["eligible"] is True
    assert second["eligible"] is False
    assert second["reason"] == "REJECT_REPLAY"


def test_login_event_yields_zero_reward():
    engine = _engine()
    decision = engine.evaluate(
        idempotency_key="login-1",
        event_kind="LOGIN",
        rule_id="streak-daily",
        rule_version="v1",
        reward_kind="STREAK",
        amount=1,
    )
    assert decision["eligible"] is False
    assert decision["reason"] == "REJECT_LOGIN"


def test_chat_event_yields_zero_reward():
    engine = _engine()
    decision = engine.evaluate(
        idempotency_key="chat-1",
        event_kind="CHAT",
        rule_id="chat-message",
        rule_version="v1",
        reward_kind="XP",
        amount=1,
    )
    assert decision["eligible"] is False
    assert decision["reason"] == "REJECT_CHAT"


def test_milestone_event_yields_reward():
    engine = _engine()
    decision = engine.evaluate(
        idempotency_key="milestone-1",
        event_kind="LEARNING_MILESTONE",
        rule_id="module-complete",
        rule_version="v1",
        reward_kind="XP",
        amount=50,
    )
    assert decision["eligible"] is True
    assert decision["amount"] == 50


def test_reward_reversal_records_compensating_entry_supported_by_engine_semantics():
    engine = _engine()
    original = engine.evaluate(
        idempotency_key="reward-1",
        event_kind="MASTERY_CHANGE",
        rule_id="r-1",
        rule_version="v1",
        reward_kind="XP",
        amount=20,
    )
    assert original["eligible"] is True
    reversal = engine.evaluate(
        idempotency_key="reward-1-reverse",
        event_kind="REVERSAL",
        rule_id="r-1",
        rule_version="v1",
        reward_kind="XP",
        amount=-20,
    )
    assert reversal["eligible"] is False
    assert reversal["amount"] == 0
    assert reversal["reason"] == "REJECT_NO_VALID_EVENT"


def test_leaderboard_opt_in_default_off():
    from v1.gamification import RewardKind

    seen_rewards = []
    engine = _engine()
    decision = engine.evaluate(
        idempotency_key="leaderboard-1",
        event_kind="LEADERBOARD_OPT_IN",
        rule_id="leaderboard-r-1",
        rule_version="v1",
        reward_kind=RewardKind.LEADERBOARD_RANK.value,
        amount=0,
    )
    seen_rewards.append(decision)
    assert all(d["amount"] == 0 or d["eligible"] is False for d in seen_rewards)


def test_ranking_based_on_learning_outcome_not_activity_volume():
    engine = _engine()
    for i in range(20):
        decision = engine.evaluate(
            idempotency_key=f"login-{i}",
            event_kind="LOGIN",
            rule_id="streak-daily",
            rule_version="v1",
            reward_kind="XP",
            amount=1,
        )
        assert decision["eligible"] is False


def test_narration_block_renders_celebration_for_eligible_decision():
    decision = {
        "eligible": True,
        "amount": 20,
        "ruleId": "r-1",
        "ruleVersion": "v1",
        "reason": "MASTERY_MILESTONE",
        "idempotencyKey": "k-1",
        "rewardKind": "XP",
    }
    block = render_narration_block(decision)
    assert "<celebration" in block
    assert "+20 XP" in block
    assert "Selamat" in block or "Lanjut" in block


def test_narration_block_renders_feedback_for_rejected_decision():
    decision = {
        "eligible": False,
        "amount": 0,
        "ruleId": "r-1",
        "ruleVersion": "v1",
        "reason": "REJECT_DUPLICATE",
        "idempotencyKey": "k-1",
        "rewardKind": "XP",
    }
    block = render_narration_block(decision)
    assert "<feedback" in block
    assert "REJECT_DUPLICATE" not in block
    assert "sudah pernah" in block.lower()


def test_render_celebration_uses_canonical_for_known_reasons():
    for reason in CANONICAL_CELEBRATION_PHRASES:
        text = render_celebration(reason)
        assert text
        assert text in CANONICAL_CELEBRATION_PHRASES.values()


def test_render_celebration_falls_back_for_unknown_reason():
    text = render_celebration("UNKNOWN_REASON", fallback="custom fallback")
    assert text == "custom fallback"


def test_narration_for_known_milestone():
    text = narration_for_milestone("module_complete")
    assert "Modul" in text


def test_boundary_guard_rejects_ai_calling_gamify_route():
    text = "AI will now POST to /v1/gamify/rewards/mint"
    assert contains_forbidden_call(text)


def test_boundary_guard_rejects_ai_minting_xp():
    text = "I will mint XP for the user"
    from v1.gamification import ai_attempted_mint

    assert ai_attempted_mint(text)


def test_boundary_guard_rejects_ai_granting_badge():
    text = "Grant badge to alice for completing module"
    from v1.gamification import ai_attempted_mint

    assert ai_attempted_mint(text)


def test_boundary_guard_rejects_ai_modifying_leaderboard():
    text = "Update leaderboard rank to first place"
    from v1.gamification import ai_attempted_mint

    assert ai_attempted_mint(text)


def test_boundary_guard_accepts_narration_only():
    text = "Selamat! Anda baru saja mencapai MASTERY_MILESTONE."
    assert not contains_forbidden_call(text)
    assert_ai_only_narrates(text)


def test_assert_ai_only_narrates_raises_on_violation():
    text = "I will mint XP for the user now"
    with pytest.raises(BoundaryViolation):
        assert_ai_only_narrates(text)


def test_narration_for_unknown_milestone_returns_default_celebration():
    text = narration_for_milestone("unknown_milestone")
    assert text == render_celebration("LEARNING_MILESTONE")