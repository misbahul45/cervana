from __future__ import annotations

import logging
from typing import Optional

import requests

from config.agent_session import AgentSession
from config.envs import ENVS
from errors.types import CrossServiceError
from v1.users_steps.dto import (
    LearningStyleProfileBase,
    StepBase,
    TopicBase,
)


logger = logging.getLogger(__name__)

API_TIMEOUT_SECONDS = 15


def _headers(session: AgentSession) -> dict[str, str]:
    return {
        "x-acting-user-id": session.acting_user_id,
        "x-trace-id": session.trace_id,
        "x-idempotency-key": session.idempotency_key,
    }


def _get(path: str, *, session: AgentSession) -> requests.Response:
    url = f"{ENVS['NEST_API']}{path}"
    logger.info("[SIGNED][GET] %s acting=%s trace=%s", url, session.acting_user_id, session.trace_id)
    try:
        response = requests.get(url, headers=_headers(session), timeout=API_TIMEOUT_SECONDS)
    except requests.RequestException as exc:
        raise CrossServiceError(
            "failed to reach internal api",
            details={"url": url, "error": str(exc)},
        ) from exc
    if response.status_code >= 500:
        raise CrossServiceError(
            "internal api error",
            details={"url": url, "status": response.status_code},
        )
    return response


def _post(path: str, *, session: AgentSession, json_body: dict) -> requests.Response:
    url = f"{ENVS['NEST_API']}{path}"
    logger.info("[SIGNED][POST] %s acting=%s trace=%s", url, session.acting_user_id, session.trace_id)
    try:
        response = requests.post(
            url,
            json=json_body,
            headers={**_headers(session), "Content-Type": "application/json"},
            timeout=20,
        )
    except requests.RequestException as exc:
        raise CrossServiceError(
            "failed to reach internal api",
            details={"url": url, "error": str(exc)},
        ) from exc
    if response.status_code >= 500:
        raise CrossServiceError(
            "internal api error",
            details={"url": url, "status": response.status_code},
        )
    return response


def get_steps(lesson_id: str, session: AgentSession) -> list[StepBase]:
    response = _get(
        f"/curriculum/steps?lessonId={lesson_id}&sort=sortOrder:asc", session=session
    )
    response.raise_for_status()
    data = response.json().get("data", {}).get("data", [])
    return [StepBase(**item) for item in data]


def get_step(step_id: str, session: AgentSession) -> StepBase:
    response = _get(f"/curriculum/steps/{step_id}", session=session)
    response.raise_for_status()
    return StepBase(**response.json().get("data"))


def get_topic(topic_id: str, session: AgentSession) -> TopicBase:
    response = _get(f"/curriculum/topics?id={topic_id}", session=session)
    response.raise_for_status()
    items = response.json().get("data", {}).get("data", [])
    if not items:
        raise CrossServiceError("topic not found", details={"topicId": topic_id})
    return TopicBase(**items[0])


def get_learning_style(
    learning_style_id: str, session: AgentSession
) -> LearningStyleProfileBase:
    response = _get(
        f"/learning/learning-styles/{learning_style_id}", session=session
    )
    response.raise_for_status()
    return LearningStyleProfileBase(**response.json().get("data"))


def create_personality_quiz(payload: dict, session: AgentSession) -> dict:
    response = _post(
        "/learning/personality-quizzes", session=session, json_body=payload
    )
    response.raise_for_status()
    return response.json()


def get_personality_quiz(
    lesson_id: str, user_id: str, session: AgentSession
) -> Optional[dict]:
    url = f"{ENVS['NEST_API']}/learning/personality-quizzes?lessonId={lesson_id}&userId={user_id}"
    logger.info("[PERSONALITY_QUIZ][GET] %s", url)
    try:
        response = _get(
            f"/learning/personality-quizzes?lessonId={lesson_id}&userId={user_id}",
            session=session,
        )
    except CrossServiceError as exc:
        logger.error("[PERSONALITY_QUIZ] API Request failed: %s", exc.message)
        return None

    if response.status_code == 404:
        return None

    response.raise_for_status()
    payload = response.json()
    data_list = payload.get("data", {}).get("data", [])
    if not data_list:
        logger.warning("[PERSONALITY_QUIZ] No quiz found for user %s", user_id)
        return None
    return data_list[0]


def classify_learning_style(description: str | None) -> Optional[str]:
    if not description:
        return None
    text = description.lower()
    if any(k in text for k in ["lihat", "visual", "gambar", "diagram", "video"]):
        return "visual"
    if any(k in text for k in ["dengar", "audio", "penjelasan lisan", "ceramah"]):
        return "auditory"
    if any(k in text for k in ["baca", "menulis", "catatan", "teks"]):
        return "reading_writing"
    if any(
        k in text
        for k in ["praktek", "langsung", "contoh nyata", "kinestetik", "kinesthetic"]
    ):
        return "kinesthetic"
    return None


async def build_learning_introduction_llm(
    steps: list,
    pipeline,
    learning_style=None,
    session: AgentSession | None = None,
):
    from config.embedding_pipeline import EmbeddingPipeline
    if isinstance(learning_style, dict):
        dominant_style = learning_style.get("dominant_style")
    elif learning_style is not None:
        dominant_style = getattr(learning_style, "dominant_style", None)
    else:
        dominant_style = None

    style = classify_learning_style(dominant_style)

    style_map = {
        "visual": (
            "Gunakan penjelasan yang mudah divisualisasikan, pola yang jelas, "
            "struktur langkah yang rapi, serta asosiasi bentuk atau alur."
        ),
        "auditory": (
            "Gunakan aliran bahasa yang runtut seperti percakapan, ritme kalimat yang enak dibaca, "
            "dan penjelasan yang terasa seperti dijelaskan secara lisan."
        ),
        "reading_writing": (
            "Gunakan struktur kalimat informatif, definisi langsung, bullet point, "
            "dan narasi ringkas yang mudah dipindai pembaca."
        ),
        "kinesthetic": (
            "Gunakan contoh nyata, langkah aplikatif, dan konteks praktis yang dapat dibayangkan "
            "sebagai tindakan dunia nyata."
        ),
    }

    style_prompt = style_map.get(
        style,
        "Gunakan gaya netral, jelas, langsung pada inti, dan mudah dipahami.",
    )

    step_data = [
        {"title": s.title, "description": s.description or ""}
        for s in steps
    ]

    retrieval_info = []
    for s in steps:
        results = pipeline.retrieve(query=s.title, top_k=5)
        texts = [r["text"] for r in results]
        if texts:
            retrieval_info.append(f"- {s.title}: {' '.join(texts)}")

    retrieval_text = "\n".join(retrieval_info) if retrieval_info else ""

    full_prompt = f"""
Kamu adalah AI Educator profesional. Tugasmu adalah membuat pengantar pembelajaran
berdasarkan langkah-langkah berikut:

{step_data}

Gunakan informasi retrieval tambahan berikut untuk memperjelas deskripsi:
{retrieval_text}

=== TUJUAN PENGANTAR ===
1. Menjelaskan isi setiap langkah dengan jelas.
2. Menunjukkan nilai atau manfaat praktis dari setiap langkah.
3. Memberikan gambaran alur pembelajaran.
4. Membuat pembelajar tertarik dan termotivasi.
5. Output dalam format Markdown yang komprehensif: gunakan header, bold, bullet, numbering, dan paragraf bebas.

=== GAYA PENULISAN ===
{style_prompt}

=== ATURAN PENULISAN TAMBAHAN ===
- Kalimat aktif dan friendly.
- Beri sedikit sentuhan storytelling agar hidup.
- Hindari jargon berlebihan namun tetap profesional.
- Tidak menyebut AI atau proses teknis.
- Buat alurnya: Hook → Context → Value → Roadmap langkah pembelajaran → Closing Motivation.
- Teks harus enak dibaca saat di-streaming per chunk.
- Sertakan informasi bahwa setelah memahami tiap materi, pembelajar akan selalu di-test dengan quiz yang membantu memperdalam pemahaman.

Instruksi tambahan:
- Hanya gunakan informasi dari steps dan retrieval.
- Mulai dengan sapaan, akhiri dengan call-to-action.
"""

    stream = pipeline.llm.stream(full_prompt)
    if hasattr(stream, "__aiter__"):
        async for chunk in stream:
            text = getattr(chunk, "text", None)
            if text:
                yield text
    else:
        for chunk in stream:
            text = getattr(chunk, "text", None)
            if text:
                yield text


def extract_quiz(result):
    quiz = result.get("quiz")
    if isinstance(quiz, list) and len(quiz) > 0 and hasattr(quiz[0], "question"):
        return quiz
    return []


async def _load_profile_and_steps(
    session: AgentSession,
    lesson_id: str,
    learning_style_id: str,
    topic_id: str | None = None,
):
    steps = get_steps(lesson_id, session)
    learning_style = get_learning_style(learning_style_id, session)
    topic = get_topic(topic_id, session) if topic_id else None
    return topic, steps, learning_style


__all__ = [
    "API_TIMEOUT_SECONDS",
    "get_steps",
    "get_step",
    "get_topic",
    "get_learning_style",
    "create_personality_quiz",
    "get_personality_quiz",
    "classify_learning_style",
    "build_learning_introduction_llm",
    "extract_quiz",
    "_load_profile_and_steps",
]