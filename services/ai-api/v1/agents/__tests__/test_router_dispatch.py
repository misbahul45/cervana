from v1.agents.router import dispatch, intent_for_agent, list_intents


def test_router_picks_tutor_for_tutor_intent():
    assert dispatch("tutor") == "tutor_agent"


def test_router_picks_creator_assistant_for_creator_intent():
    assert dispatch("creator_assistant") == "creator_assistant_agent"


def test_router_picks_career_for_career_intent():
    assert dispatch("career") == "career_agent"


def test_router_rejects_unknown_intent():
    import pytest
    with pytest.raises(ValueError):
        dispatch("unknown_intent")


def test_router_does_not_use_llm():
    """router must not call any LLM (per spec §4.2 AI-2)."""
    import inspect
    source = inspect.getsource(dispatch)
    assert "pipeline.llm" not in source
    assert "pipeline.llm_thinking" not in source


def test_intent_for_agent_roundtrip():
    assert intent_for_agent("tutor_agent") == "tutor"
    assert intent_for_agent("career_agent") == "career"


def test_list_intents_returns_all_five():
    intents = list_intents()
    assert len(intents) == 5
    assert "tutor" in intents
    assert "curriculum" in intents
    assert "assessment" in intents
    assert "creator_assistant" in intents
    assert "career" in intents