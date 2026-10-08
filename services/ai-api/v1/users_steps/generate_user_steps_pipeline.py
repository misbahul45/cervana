from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, Optional

import requests
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from config.agent_session import AgentSession, session_payload_is_safe
from config.embedding_pipeline import get_embedding_pipeline
from errors.types import CrossServiceError, MemoryError, RetrievalError
from utils.tools.memory import tool_memory_read, tool_memory_upsert, tool_semantic_search
from utils.tools.web_search import tool_web_search
from v1.users_steps.dto import LPState
from v1.users_steps.service import (
    classify_learning_style,
    get_learning_style,
    get_personality_quiz,
    get_step,
    get_steps,
    get_topic,
)


logger = logging.getLogger(__name__)
embed_pipeline = get_embedding_pipeline()


def _session(state: LPState) -> AgentSession:
    return AgentSession(
        session_id=state.session_id,
        acting_user_id=state.acting_user_id,
        tenant_id=state.tenant_id,
        trace_id=state.trace_id,
        idempotency_key=state.idempotency_key,
        issued_at_ms=0,
    )


def node_fetch(state: LPState) -> LPState:
    session = _session(state)
    logger.info("[FETCH] Starting data collection for user %s", state.user_id)

    state.topic = get_topic(state.topic_id, session)
    if not state.topic:
        state.error = "Failed to fetch topic"
        return state

    try:
        state.learning_style = get_learning_style(state.learning_style_id, session)
    except CrossServiceError as exc:
        logger.warning("[FETCH] Learning style not found: %s", exc.message)

    state.all_lesson_steps = get_steps(state.lesson_id, session)
    logger.info("[FETCH] Found %d steps in lesson", len(state.all_lesson_steps))

    if state.target_step_id:
        try:
            state.target_step = get_step(state.target_step_id, session)
        except CrossServiceError as exc:
            logger.warning("[FETCH] Target step %s not found: %s", state.target_step_id, exc.message)

    try:
        state.personality_quiz_raw = get_personality_quiz(
            state.lesson_id, state.user_id, session
        )
    except CrossServiceError as exc:
        logger.warning("[FETCH] personality quiz fetch failed: %s", exc.message)

    return state


def node_build_context(state: LPState) -> LPState:
    logger.info("[BUILD CONTEXT] Constructing learning context")

    parts: list[str] = []

    if state.topic:
        parts.append(f"📚 TOPIC: {state.topic.title}")
        parts.append(f"Description: {state.topic.description}")
        parts.append(f"Duration: {state.topic.topic_duration} days")

    if state.learning_style:
        parts.append("\n🎨 LEARNING STYLE: " + (state.learning_style.dominant_style or "Unknown"))
        parts.append(f"Visual: {state.learning_style.visual}%")
        parts.append(f"Auditory: {state.learning_style.auditory}%")
        parts.append(f"Kinesthetic: {state.learning_style.kinesthetic}%")
        parts.append(f"Reading/Writing: {state.learning_style.reading}%")

    if state.personality_quiz_result:
        parts.append("\n🧠 PERSONALITY PROFILE:")
        parts.append(f"Strengths: {', '.join(state.personality_quiz_result.strengths)}")
        parts.append(f"Weaknesses: {', '.join(state.personality_quiz_result.weaknesses)}")
        parts.append(f"Learning Preferences: {', '.join(state.personality_quiz_result.learning_preferences)}")
        parts.append(f"Motivation Factors: {', '.join(state.personality_quiz_result.motivation_factors)}")
        parts.append(f"Challenges: {', '.join(state.personality_quiz_result.challenges)}")

    if state.all_lesson_steps:
        parts.append("\n🗺️ LESSON ROADMAP:")
        for idx, step in enumerate(
            sorted(state.all_lesson_steps, key=lambda x: x.sort_order), 1
        ):
            marker = "⭐" if state.target_step and step.id == state.target_step.id else "  "
            parts.append(f"{marker} {idx}. {step.title}")

    if state.target_step:
        parts.append("\n🎯 TARGET STEP (PRIMARY GOAL):")
        parts.append(f"Title: {state.target_step.title}")
        parts.append(f"Description: {state.target_step.description}")
        parts.append(f"Order: {state.target_step.sort_order}")
        parts.append(
            "\n⚠️ CRITICAL: All generated steps MUST lead to mastering this target step!"
        )

    state.context = "\n".join(parts)
    logger.info("[BUILD CONTEXT] Context built: %d chars", len(state.context))

    return state


def node_read_memory(state: LPState) -> LPState:
    logger.info("[MEMORY] Loading user history")

    try:
        memories = tool_memory_read(state.user_id, state.lesson_id, limit=10)
    except MemoryError as exc:
        logger.warning("[MEMORY] read failed: %s", exc.message)
        memories = []

    if not memories:
        state.memory = ""
        return state

    state.memory = " | ".join([m.get("text", "") for m in memories])
    return state


def node_semantic_search(state: LPState) -> LPState:
    try:
        results = tool_semantic_search(
            user_id=state.user_id,
            lesson_id=state.lesson_id,
        )
    except RetrievalError as exc:
        logger.warning("[SEMANTIC] search failed: %s", exc.message)
        results = []
    state.semantic_results = "\n".join([f"- {r.get('text', '')}" for r in results])
    return state


def node_external_search(state: LPState) -> LPState:
    logger.info("[EXTERNAL SEARCH] Searching web resources")

    if state.topic and state.target_step:
        query = f"how to learn {state.target_step.title} in {state.topic.title}"
        state.external_results = tool_web_search(query)

    return state


def node_personality_material_builder(state: LPState) -> LPState:
    logger.info("[PERSONALITY MATERIAL] LLM-based personality interpretation")

    import json as _json

    raw = state.personality_quiz_raw or {}
    if hasattr(raw, "model_dump"):
        raw = raw.model_dump()

    scores = raw.get("result", {})
    attempts = raw.get("userAttempt", [])

    user_answers = []
    for a in attempts:
        if hasattr(a, "userAnswer"):
            user_answers.append(a.userAnswer)
        elif isinstance(a, dict):
            user_answers.append(a.get("userAnswer"))

    try:
        scores_json = _json.dumps(scores, indent=2)
    except Exception:
        scores_json = _json.dumps(_json.loads(_json.dumps(scores, default=str)), indent=2)

    prompt = f"""
You are an AI Personality Interpretation Engine.

Your task:
Analyze the user's personality data from psychological quiz scoring AND user answers.
Create a HUMAN-LIKE personality profile based on observable behavior patterns.

==============
RAW SCORE DATA
==============
{scores_json}

==============
USER ANSWERS (BEHAVIOR CLUES)
==============
{_json.dumps(user_answers, indent=2)}

==============
INSTRUCTIONS
==============
1. Interpret strengths & weaknesses based on patterns in scores.
2. Use behavioral clues in userAnswer to detect learning preferences.
3. Motivation factors MUST be inferred from personality traits.
4. Challenges must be realistic obstacles that match the user's weak spots.
5. KEEP IT SHORT, PRACTICAL, REALISTIC.
6. Output STRICT VALID JSON ONLY with structure:

{{
  "strengths": ["..."],
  "weaknesses": ["..."],
  "learningPreferences": ["..."],
  "motivationFactors": ["..."],
  "challenges": ["..."]
}}

NO commentary, NO markdown.
"""

    from v1.users_steps.dto import PersonalityQuizResult

    system_msg = SystemMessage(content="You are an expert personality engine. Only return VALID JSON.")
    user_msg = HumanMessage(content=prompt)

    try:
        response = embed_pipeline.llm.invoke([system_msg, user_msg])
        content = response.content.strip()

        if content.startswith("```"):
            lines = content.split("\n")
            json_lines = [l for l in lines if not l.strip().startswith("```")]
            content = "\n".join(json_lines).strip()

        data = _json.loads(content)

        strengths = data.get("strengths") or ["Rasa ingin tahu tinggi"]
        weaknesses = data.get("weaknesses") or ["Perlu meningkatkan konsistensi belajar"]
        learning_preferences = data.get("learningPreferences") or ["Visual"]
        motivation_factors = data.get("motivationFactors") or ["progres kecil bertahap"]
        challenges = data.get("challenges") or ["butuh struktur belajar jelas"]

        state.personality_quiz_result = PersonalityQuizResult(
            user_id=state.user_id,
            strengths=strengths,
            weaknesses=weaknesses,
            learning_preferences=learning_preferences,
            motivation_factors=motivation_factors,
            challenges=challenges,
        )
        logger.info("[PERSONALITY MATERIAL] LLM insights generated successfully")
    except Exception as exc:
        logger.error("[PERSONALITY MATERIAL] Error: %s", exc)
        from v1.users_steps.dto import PersonalityQuizResult

        state.personality_quiz_result = PersonalityQuizResult(
            user_id=state.user_id,
            strengths=["Rasa ingin tahu tinggi"],
            weaknesses=["Perlu meningkatkan konsistensi belajar"],
            learning_preferences=["Visual"],
            motivation_factors=["progres kecil bertahap"],
            challenges=["butuh struktur belajar jelas"],
        )

    return state


def node_generate(state: LPState) -> LPState:
    logger.info("[GENERATE] Creating goal-oriented learning path")

    prompt = f"""
You are **AI Learning Path Master Agent**.
Your ONLY output must be **VALID JSON** that strictly follows the schema. Any deviation = failure.

==============
MISSION
==============
Generate a personalized micro-learning roadmap to help the learner MASTER the target step with **minimum cognitive overload** and **maximum motivation**.

==============
CONTEXT
==============
USER PROFILE:
{state.context}

PERSONALITY INSIGHTS:
Strengths: {', '.join(state.personality_quiz_result.strengths)}
Weaknesses: {', '.join(state.personality_quiz_result.weaknesses)}
Learning Preferences: {', '.join(state.personality_quiz_result.learning_preferences)}
Motivation Triggers: {', '.join(state.personality_quiz_result.motivation_factors)}
Challenges: {', '.join(state.personality_quiz_result.challenges)}

PRIMARY GOAL:
- Step Title: {state.target_step.title}
- Description: {state.target_step.description}
- Position: {state.target_step.sort_order} / {len(state.all_lesson_steps)}

==============
STRICT RULES (NO EXCEPTIONS)
==============
1️⃣ Output MUST be JSON ONLY. No markdown. No explanation. No comments.
2️⃣ JSON MUST be valid, parseable, and follow EXACT schema and key ordering.
3️⃣ Titles:
   - Language: Bahasa Indonesia
   - Motivational, practical, short
   - One micro-skill per step ONLY
4️⃣ No duplicate or similar actions from prior memory.
5️⃣ Difficulty must adapt to personality:
   - Sociable: include teamwork/collab tasks
   - Weak focus: break into tiny wins
   - Easily bored: add mission/challenge theme
6️⃣ Cognitive load LOW, motivation HIGH.
7️⃣ Property values MUST match type exactly.
8️⃣ `userId` and `stepTemplateId` MUST use values given.
9️⃣ **ORDER IS CRITICAL**:
   - `order` MUST be a number (integer)
   - Start from **1**
   - Must increase sequentially without gaps
   - Defines structured learning progression — this is VERY IMPORTANT

==============
OUTPUT FORMAT (MANDATORY)
==============
{{
  "data": [
    {{
      "userId": "{state.user_id}",
      "stepTemplateId": "{state.target_step.id}",
      "title": "Judul langkah spesifik, Bahasa Indonesia, actionable",
      "isDone": false,
      "order": 1
    }}
  ]
}}

==============
VALIDATION BEFORE SUBMITTING
==============
✔ Output EXACTLY ONE root JSON object
✔ Keys MUST NOT be renamed, removed, or added
✔ Booleans must be lowercase (`false`)
✔ No newlines or text outside JSON

RETURN NOW: JSON ONLY
"""

    from v1.users_steps.dto import GenerateUserStepRespon

    system_msg = SystemMessage(
        content="You are an elite learning path architect. Return STRICT valid JSON only."
    )
    user_msg = HumanMessage(content=prompt)

    try:
        response = embed_pipeline.llm_thinking.invoke([system_msg, user_msg])
        text = response.content.strip()

        if text.startswith("```"):
            lines = text.split("\n")
            json_lines = [l for l in lines if not l.strip().startswith("```")]
            text = "\n".join(json_lines).strip()

        text = text.replace("```json", "").replace("```", "").strip()
        import json as _json

        payload = _json.loads(text)
        validated = GenerateUserStepRespon(**payload)
        state.generated = validated

        summary = " | ".join([s.title for s in validated.data])
        try:
            tool_memory_upsert(
                user_id=state.user_id,
                lesson_id=state.lesson_id,
                text=summary,
            )
        except MemoryError as exc:
            logger.warning("[GENERATE] memory upsert failed: %s", exc.message)
    except Exception as exc:
        logger.error("[GENERATE] Error: %s", exc)
        from v1.users_steps.dto import BaseUserStep, GenerateUserStepRespon

        state.error = "Generation failed"
        fallback_title = state.target_step.title if state.target_step else "Belajar topik"
        state.generated = GenerateUserStepRespon(
            data=[
                BaseUserStep(
                    user_id=state.user_id,
                    step_template_id=state.target_step.id if state.target_step else None,
                    title=f"Mulai dari pemahaman dasar: {fallback_title}",
                    is_done=False,
                )
            ]
        )

    return state


def build_graph():
    g = StateGraph(LPState)
    g.add_node("fetch", node_fetch)
    g.add_node("personality_material_builder", node_personality_material_builder)
    g.add_node("build_context", node_build_context)
    g.add_node("read_memory", node_read_memory)
    g.add_node("semantic_search", node_semantic_search)
    g.add_node("external_search", node_external_search)
    g.add_node("generate", node_generate)

    g.set_entry_point("fetch")
    g.add_edge("fetch", "personality_material_builder")
    g.add_edge("personality_material_builder", "build_context")
    g.add_edge("build_context", "read_memory")
    g.add_edge("read_memory", "semantic_search")
    g.add_edge("semantic_search", "external_search")
    g.add_edge("external_search", "generate")
    g.add_edge("generate", END)

    return g.compile()


generate_user_steps_pipeline = build_graph()


__all__ = [
    "node_fetch",
    "node_build_context",
    "node_read_memory",
    "node_semantic_search",
    "node_external_search",
    "node_personality_material_builder",
    "node_generate",
    "build_graph",
    "generate_user_steps_pipeline",
]