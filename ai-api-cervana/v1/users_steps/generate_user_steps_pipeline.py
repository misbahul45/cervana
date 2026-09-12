import os
import json
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime

import requests
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, END
from pydantic import BaseModel, Field

from v1.users_steps.dto import *
from v1.users_steps.service import *
from utils.tools.memory import * 
from utils.tools.web_search import * 
from utils.tools.memory import *
from config.embedding_pipeline import get_embedding_pipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


embed_pipeline=get_embedding_pipeline()

def node_fetch(state: LPState) -> LPState:
    logger.info(f"[FETCH] Starting data collection for user {state.userId}")
    
    state.topic = get_topic(state.topicId, state.token)
    if not state.topic:
        state.error = "Failed to fetch topic"
        return state
    
    state.learningStyle = get_learning_style(state.learningStyleId, state.token)
    if not state.learningStyle:
        logger.warning("[FETCH] Learning style not found")
    

    state.allLessonSteps = get_steps(state.lessonId, state.token)
    logger.info(f"[FETCH] Found {len(state.allLessonSteps)} steps in lesson")
    
    # Fetch target step if specified
    if state.targetStepId:
        state.targetStep = get_step(state.targetStepId, state.token)
        if state.targetStep:
            logger.info(f"[FETCH] Target step: {state.targetStep.title}")
        else:
            logger.warning(f"[FETCH] Target step {state.targetStepId} not found")
    
    # Fetch personality quiz results
    state.personalityQuizRaw = get_personality_quiz(state.lessonId,state.userId, state.token)
    if state.personalityQuizResult:
        logger.info(f"[FETCH] Personality quiz loaded with {len(state.personalityQuizResult.strengths)} strengths")
    
    return state

def node_build_context(state: LPState) -> LPState:
    """Build comprehensive context from fetched data"""
    logger.info("[BUILD CONTEXT] Constructing learning context")
    
    parts = []
    
    if state.topic:
        parts.append(f"📚 TOPIC: {state.topic.title}")
        parts.append(f"Description: {state.topic.description}")
        parts.append(f"Duration: {state.topic.topicDuration} days")
    
    if state.learningStyle:
        parts.append(f"\n🎨 LEARNING STYLE: {state.learningStyle.dominantStyle}")
        parts.append(f"Visual: {state.learningStyle.visual}%")
        parts.append(f"Auditory: {state.learningStyle.auditory}%")
        parts.append(f"Kinesthetic: {state.learningStyle.kinesthetic}%")
        parts.append(f"Reading/Writing: {state.learningStyle.reading}%")
    
    if state.personalityQuizResult:
        parts.append("\n🧠 PERSONALITY PROFILE:")
        parts.append(f"Strengths: {', '.join(state.personalityQuizResult.strengths)}")
        parts.append(f"Weaknesses: {', '.join(state.personalityQuizResult.weaknesses)}")
        parts.append(f"Learning Preferences: {', '.join(state.personalityQuizResult.learningPreferences)}")
        parts.append(f"Motivation Factors: {', '.join(state.personalityQuizResult.motivationFactors)}")
        parts.append(f"Challenges: {', '.join(state.personalityQuizResult.challenges)}")
    
    if state.allLessonSteps:
        parts.append("\n🗺️ LESSON ROADMAP:")
        for idx, step in enumerate(sorted(state.allLessonSteps, key=lambda x: x.sortOrder), 1):
            marker = "⭐" if state.targetStep and step.id == state.targetStep.id else "  "
            parts.append(f"{marker} {idx}. {step.title}")
    
    if state.targetStep:
        parts.append(f"\n🎯 TARGET STEP (PRIMARY GOAL):")
        parts.append(f"Title: {state.targetStep.title}")
        parts.append(f"Description: {state.targetStep.description}")
        parts.append(f"Order: {state.targetStep.sortOrder}")
        parts.append(f"\n⚠️ CRITICAL: All generated steps MUST lead to mastering this target step!")
    
    state.context = "\n".join(parts)
    logger.info(f"[BUILD CONTEXT] Context built: {len(state.context)} chars")
    
    return state


def node_read_memory(state: LPState) -> LPState:
    logger.info("[MEMORY] Loading user history")

    memories = tool_memory_read(state.userId, state.lessonId, limit=10)

    if not memories:
        logger.info("[MEMORY] No prior memory found")
        state.memory = ""
        return state

    combined_text = " | ".join([m["text"] for m in memories])
    state.memory = combined_text

    return state


def node_semantic_search(state: LPState) -> LPState:
    results = tool_semantic_search(
        userId=state.userId,
        lessonId=state.lessonId
    )

    state.semanticResults = "\n".join([
        f"- {r.get('text', '')}"
        for r in results
    ])

    return state

def node_external_search(state: LPState) -> LPState:
    """External web search for additional resources"""
    logger.info("[EXTERNAL SEARCH] Searching web resources")
    
    if state.topic and state.targetStep:
        query = f"how to learn {state.targetStep.title} in {state.topic.title}"
        state.externalResults = tool_web_search(query)
    
    return state


def node_personality_material_builder(state: LPState) -> LPState:
    logger.info("[PERSONALITY MATERIAL] LLM-based personality interpretation")

    raw = state.personalityQuizRaw or {}

    # Convert to dict if this is a Pydantic object
    if hasattr(raw, "model_dump"):
        raw = raw.model_dump()

    scores = raw.get("result", {})
    attempts = raw.get("userAttempt", [])

    # Normalize attempt items into a list of answers
    user_answers = []
    for a in attempts:
        if hasattr(a, "userAnswer"):
            user_answers.append(a.userAnswer)
        elif isinstance(a, dict):
            user_answers.append(a.get("userAnswer"))

    try:
        scores_json = json.dumps(scores, indent=2)
    except:
        scores_json = json.dumps(json.loads(json.dumps(scores, default=str)), indent=2)


    # Siapkan prompt untuk LLM
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
{json.dumps(user_answers, indent=2)}

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

    system_msg = SystemMessage(
        content="You are an expert personality engine. Only return VALID JSON."
    )
    user_msg = HumanMessage(content=prompt)

    try:
        response = embed_pipeline.llm.invoke([system_msg, user_msg])
        content = response.content.strip()

        # Bersihkan jika LLM menambah ```json
        if content.startswith("```"):
            lines = content.split("\n")
            json_lines = [l for l in lines if not l.strip().startswith("```")]
            content = "\n".join(json_lines).strip()

        data = json.loads(content)

        # validasi & fallback jika field kosong
        strengths = data.get("strengths") or ["Rasa ingin tahu tinggi"]
        weaknesses = data.get("weaknesses") or ["Perlu meningkatkan konsistensi belajar"]
        learningPreferences = data.get("learningPreferences") or ["Visual"]
        motivationFactors = data.get("motivationFactors") or ["progres kecil bertahap"]
        challenges = data.get("challenges") or ["butuh struktur belajar jelas"]

        state.personalityQuizResult = PersonalityQuizResult(
            userId=state.userId,
            strengths=strengths,
            weaknesses=weaknesses,
            learningPreferences=learningPreferences,
            motivationFactors=motivationFactors,
            challenges=challenges
        )

        logger.info("[PERSONALITY MATERIAL] LLM insights generated successfully")
    
    except Exception as e:
        logger.error(f"[PERSONALITY MATERIAL] Error: {e}")
        # fallback minimal
        state.personalityQuizResult = PersonalityQuizResult(
            userId=state.userId,
            strengths=["Rasa ingin tahu tinggi"],
            weaknesses=["Perlu meningkatkan konsistensi belajar"],
            learningPreferences=["Visual"],
            motivationFactors=["progres kecil bertahap"],
            challenges=["butuh struktur belajar jelas"]
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
Strengths: {', '.join(state.personalityQuizResult.strengths)}
Weaknesses: {', '.join(state.personalityQuizResult.weaknesses)}
Learning Preferences: {', '.join(state.personalityQuizResult.learningPreferences)}
Motivation Triggers: {', '.join(state.personalityQuizResult.motivationFactors)}
Challenges: {', '.join(state.personalityQuizResult.challenges)}

PRIMARY GOAL:
- Step Title: {state.targetStep.title}
- Description: {state.targetStep.description}
- Position: {state.targetStep.sortOrder} / {len(state.allLessonSteps)}

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
      "userId": "{state.userId}",
      "stepTemplateId": "{state.targetStep.id}",
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


    system_msg = SystemMessage(
        content="You are an elite learning path architect. Return STRICT valid JSON only."
    )
    user_msg = HumanMessage(content=prompt)

    try:
        response = embed_pipeline.llm.invoke([system_msg, user_msg])
        text = response.content.strip()

        if text.startswith("```"):
            lines = text.split("\n")
            json_lines = [l for l in lines if not l.strip().startswith("```")]
            text = "\n".join(json_lines).strip()

        text = text.replace("```json", "").replace("```", "").strip()
        payload = json.loads(text)
        validated = GenerateUserStepRespon(**payload)
        state.generated = validated

        summary = " | ".join([s.title for s in validated.data])
        tool_memory_upsert(userId=state.userId, lessonId=state.lessonId, text=summary)

    except Exception as e:
        logger.error(f"[GENERATE] Error: {e}")
        state.error = "Generation failed"
        fallback_title = state.targetStep.title if state.targetStep else "Belajar topik"
        state.generated = GenerateUserStepRespon(data=[
            BaseUserStep(
                userId=state.userId,
                stepTemplateId=state.targetStep.id if state.targetStep else None,
                title=f"Mulai dari pemahaman dasar: {fallback_title}",
                isDone=False
            )
        ])

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

    # ORDER HARUS SERIAL
    g.add_edge("fetch", "personality_material_builder")
    g.add_edge("personality_material_builder", "build_context")
    g.add_edge("build_context", "read_memory")
    g.add_edge("read_memory", "semantic_search")
    g.add_edge("semantic_search", "external_search")
    g.add_edge("external_search", "generate")

    g.add_edge("generate", END)

    return g.compile()

generate_user_steps_pipeline = build_graph()
