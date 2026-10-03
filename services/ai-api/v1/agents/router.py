"""Deterministic agent router.

Picks an agent by intent string. Does NOT use an LLM to decide routing.
Per spec §4.2 AI-2.
"""

INTENT_TO_AGENT = {
    "tutor": "tutor_agent",
    "curriculum": "curriculum_agent",
    "assessment": "assessment_agent",
    "creator_assistant": "creator_assistant_agent",
    "career": "career_agent",
}

VALID_INTENTS = ("tutor", "curriculum", "assessment", "creator_assistant", "career")


def dispatch(intent: str) -> str:
    if intent not in INTENT_TO_AGENT:
        raise ValueError(f"unknown_intent:{intent}")
    return INTENT_TO_AGENT[intent]


def intent_for_agent(name: str) -> str:
    for intent, agent in INTENT_TO_AGENT.items():
        if agent == name:
            return intent
    raise ValueError(f"unknown_agent:{name}")


def list_intents() -> list:
    return list(VALID_INTENTS)