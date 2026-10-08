from __future__ import annotations

import logging

from config.agent_session import AgentSession
from config.embedding_pipeline import get_embedding_pipeline
from config.model_router import get_router
from config.prompt_segmentation import build_segmented_prompt, segment_retrieved
from errors.types import CrossServiceError, MemoryError, RetrievalError
from utils.tools.memory import tool_memory_upsert, tool_semantic_search
from utils.tools.web_search import tool_web_search
from v1.domain import load_default_taxonomy
from v1.domain.context import render_domain_context
from v1.tutor.personalization_prompt import render_tutor_prompt
from v1.tutor.tutor_state import TutorRunState
from v1.tutor.context_loaders import TutorRuntime
from v1.learning.dto import (
    CitationDto,
    GenerateContentMaterialPipeline,
    GenerateContentMaterialResponseDto,
)
from v1.learning.service import (
    create_content_material,
    get_lesson,
    get_user_step,
    query_content_history,
    update_message_chat,
)
from v1.users_steps.service import (
    get_learning_style,
    get_step,
    get_topic,
)
from langgraph.graph import END, START, StateGraph


logger = logging.getLogger(__name__)
pipeline = get_embedding_pipeline()
_DOMAIN_GRAPH = load_default_taxonomy()
_DOMAIN_CONTEXT_BLOCK = render_domain_context(_DOMAIN_GRAPH)
_TUTOR_RUNTIME = TutorRuntime(domain_graph=_DOMAIN_GRAPH)


def _render_tutor_system_policy(state: GenerateContentMaterialPipeline) -> str:
    run_state = TutorRunState(
        trace_id=state.trace_id,
        learner_id=state.acting_user_id,
        lesson_id=state.lesson_id,
        step_id=state.step_id,
        topic_id=state.topic_id,
        session_id=state.session_id,
        user_query="continue material",
        acting_user_id=state.acting_user_id,
        tenant_id=state.tenant_id,
        idempotency_key=state.idempotency_key,
    )
    run_state.domain_ontology_block = _DOMAIN_CONTEXT_BLOCK
    return render_tutor_prompt(run_state)


def _session(state: GenerateContentMaterialPipeline) -> AgentSession:
    return AgentSession(
        session_id=state.session_id,
        acting_user_id=state.acting_user_id,
        tenant_id=state.tenant_id,
        trace_id=state.trace_id,
        idempotency_key=state.idempotency_key,
        issued_at_ms=0,
    )


def parallel_fetch(state: GenerateContentMaterialPipeline) -> GenerateContentMaterialPipeline:
    session = _session(state)
    try:
        state.lesson = get_lesson(state.lesson_id, session)
    except CrossServiceError as exc:
        raise exc

    try:
        state.step = get_step(state.step_id, session)
    except CrossServiceError as exc:
        raise exc

    try:
        state.topic = get_topic(state.topic_id, session)
    except CrossServiceError as exc:
        raise exc

    update_message_chat(
        state.message_id,
        session,
        {
            "text": f"Fetching data for Lesson: {state.lesson.title}, Step: {state.step.title}, Topic: {state.topic.title}",
            "status": "PROCESSING",
        },
    )

    if state.learning_style_id:
        try:
            state.learning_style = get_learning_style(state.learning_style_id, session)
        except CrossServiceError as exc:
            logger.warning(
                "Learning style with ID %s not found: %s",
                state.learning_style_id,
                exc.message,
            )

    try:
        state.user_step = get_user_step(state.user_step_id, session)
    except CrossServiceError as exc:
        logger.warning(
            "User step with ID %s not found: %s",
            state.user_step_id,
            exc.message,
        )

    return state


def prepare_learning_context(
    state: GenerateContentMaterialPipeline,
) -> GenerateContentMaterialPipeline:
    session = _session(state)
    topic = state.topic
    lesson = state.lesson
    step = state.step
    user_step = state.user_step
    learning_style = state.learning_style

    topic_title = topic.title if topic else "Unknown Topic"
    lesson_title = lesson.title if lesson else "Unknown Lesson"
    step_title = step.title if step else "Unknown Step"
    learning_style_str = (
        learning_style.dominant_style if learning_style else "Not Specified"
    )

    update_message_chat(
        state.message_id,
        session,
        {
            "text": (
                f"Preparing learning context for Topic: {topic_title}, "
                f"Lesson: {lesson_title}, Step: {step_title}, "
                f"materi pembelajaran/target topic pemahaman: {user_step.title}, "
                f"Learning Style: {learning_style_str}"
            )
        },
    )

    prompt = f"""
You are an Instructional Design Expert.
Topic: {topic_title}
Lesson: {lesson_title}
Step: {step_title}
materi pembelajaran/target topic pemahaman: {user_step.title}
Learning Style: {learning_style_str}
Output: 3 sentences + bullet focused next + bullet learning plan
"""

    try:
        analysis = get_router().invoke(
            "learner_analysis",
            prompt,
            query=user_step.title,
            subject=state.acting_user_id,
        ).text
    except Exception as exc:
        logger.error("[PREPARE_CONTEXT] LLM call failed: %s", exc)
        analysis = (
            f"Analysis unavailable for {user_step.title}. "
            "Continue with the current material."
        )
    state.analysis = analysis

    if state.acting_user_id and state.lesson_id:
        try:
            tool_memory_upsert(
                user_id=state.acting_user_id,
                lesson_id=state.lesson_id,
                text=analysis,
            )
        except MemoryError as exc:
            logger.warning("[PREPARE_CONTEXT] memory upsert failed: %s", exc.message)

    try:
        memories = tool_semantic_search(
            user_id=state.acting_user_id,
            lesson_id=state.lesson_id,
            top_k=15,
        )
    except RetrievalError as exc:
        logger.warning("[PREPARE_CONTEXT] memory search failed: %s", exc.message)
        memories = []
    merged_memory = "\n".join([m.get("text", "") for m in memories]) if memories else ""

    history_query = f"{topic_title} {lesson_title} {step_title} {learning_style_str}"

    try:
        history_results = query_content_history(
            chat_id=state.chat_id,
            query=history_query,
            session=session,
        )
    except CrossServiceError as exc:
        logger.warning("[PREPARE_CONTEXT] history fetch failed: %s", exc.message)
        history_results = []

    history_merged = "\n".join(
        [h.get("chunkText", "") for h in history_results if h.get("chunkText")]
    )

    final_context = f"""
[Learning Analysis]
{analysis}

[Memory]
{merged_memory}

[Content History]
{history_merged}
""".strip()

    state.context = final_context
    return state


def retrieve_material_rag(
    state: GenerateContentMaterialPipeline,
) -> tuple[str, list[CitationDto]]:
    query = (
        f"{state.topic.title if state.topic else ''} "
        f"{state.lesson.title if state.lesson else ''} "
        f"{state.step.title if state.step else ''}"
    )
    session = _session(state)
    try:
        results = pipeline.retrieve(query=query, metadata_filter={"source": "material"}, top_k=10)
        update_message_chat(
            state.message_id,
            session,
            {
                "text": f"Retrieved {len(results)} RAG materials for query: {query}",
                "status": "PROCESSING",
            },
        )
        if not results:
            return "", []
        text = "\n".join([r["text"] for r in results])
        citations: list[CitationDto] = []
        for r in results:
            score = float(r.get("score", 0.0))
            if score <= 0.0:
                continue
            try:
                citations.append(
                    CitationDto(
                        lesson_id=r.get("metadata", {}).get("lessonId", state.lesson_id),
                        chunk_id=r.get("metadata", {}).get("chunk_index"),
                        score=score,
                        source=r.get("metadata", {}).get("source", "reducera-embedding"),
                        snippet=(r.get("text", "") or "")[:200],
                    )
                )
            except Exception as exc:
                logger.warning("[RAG] skipping malformed citation: %s", exc)
        return text, citations
    except RetrievalError as exc:
        logger.warning("[RAG] retrieval failed: %s", exc.message)
        return "", []


def retrieve_material_web(state: GenerateContentMaterialPipeline) -> str:
    query = (
        f"{state.topic.title if state.topic else ''} "
        f"{state.step.title if state.step else ''} "
        "learning material summary"
    )
    session = _session(state)
    try:
        update_message_chat(
            state.message_id,
            session,
            {
                "text": f"Performing web search for query: {query}",
                "status": "PROCESSING",
            },
        )
        return tool_web_search(query, limit=5)
    except RetrievalError as exc:
        logger.warning("[WEB] web search failed: %s", exc.message)
        return ""


def generate_material(
    state: GenerateContentMaterialPipeline,
) -> GenerateContentMaterialPipeline:
    session = _session(state)
    rag, rag_citations = retrieve_material_rag(state)
    web = retrieve_material_web(state)

    update_message_chat(
        state.message_id,
        session,
        {
            "text": "Generating learning content based on current step.",
            "status": "PROCESSING",
        },
    )

    topic_title = state.topic.title if state.topic else "Topik"
    lesson_title = state.lesson.title if state.lesson else "Pelajaran"
    step_title = state.step.title if state.step else "Sub Materi"
    learning_style = (
        state.learning_style.dominant_style
        if state.learning_style
        else "Default"
    )

    rag_segmented = segment_retrieved(
        [{"id": f"rag-{i}", "text": c} for i, c in enumerate(rag.split("\n")) if c.strip()],
        source="reducera-embedding",
    )
    web_segmented = segment_retrieved(
        [{"id": f"web-{i}", "text": c} for i, c in enumerate(web.split("\n")) if c.strip()],
        source="tavily-web",
    )

    task_segment = (
        f"Topik: {topic_title}\n"
        f"Pelajaran: {lesson_title}\n"
        f"Step / Kompetensi: {step_title}\n"
        f"User Step: {state.user_step.title}\n"
        f"Gaya Belajar User: {learning_style}"
    )

    prompt = build_segmented_prompt(
        system_policy=_render_tutor_system_policy(state),
        educational_policy=(
            "Bahasa Indonesia profesional dan mudah dipahami. "
            "Relevan langsung dengan kompetensi step ini. "
            "Fokus pada pengetahuan, praktik, dan contoh nyata. "
            "Panjang 300 sampai 700 kata. Gunakan Markdown. "
            "Output langsung materi belajar tanpa kata pembuka tambahan. "
            "Dilarang membahas pembuatan kurikulum. "
            "Semua jawaban mekanika akuntansi (debit/credit, normal balance, contra account) "
            "harus konsisten dengan ontologi domain."
        ),
        course_context=(
            f"Topik: {topic_title}\n"
            f"Pelajaran: {lesson_title}\n"
            f"Step: {step_title}\n"
            f"User Step: {state.user_step.title}"
        ),
        learner_state=(f"Learning Style: {learning_style}"),
        relevant_memory=f"Konteks pembelajaran sebelumnya:\n{state.context}",
        current_task=task_segment,
        adaptive_strategy=(
            "Format output markdown dengan bagian: "
            "Mengapa Hal Ini Penting, Materi Inti, Contoh Praktik di Dunia Kerja, "
            "Latihan Singkat (3-5 soal), Ringkasan Kunci (3-7 poin)."
        ),
        retrieved_documents=f"{rag_segmented}\n\n{web_segmented}",
    )

    content = get_router().invoke(
        "lesson_content",
        prompt,
        query=state.user_step.title,
        context_chars=len(prompt),
        subject=state.acting_user_id,
    ).text

    state.generate = {
        "chat_id": state.chat_id,
        "chat_message_id": state.message_id,
        "data": content,
        "citations": [c.model_dump(by_alias=True, exclude_none=True) for c in rag_citations],
        "metadata": {
            "topicId": state.topic_id,
            "lessonId": state.lesson_id,
            "stepId": state.step_id,
            "userStepId": state.user_step_id,
            "userId": state.acting_user_id,
        },
    }

    try:
        validated = GenerateContentMaterialResponseDto.model_validate(state.generate)
        state.generate = validated.model_dump(by_alias=True, exclude_none=True)
    except Exception as exc:
        logger.error(
            "[GENERATE] response schema validation failed: %s; raising SchemaValidationError",
            exc,
        )
        from errors.types import SchemaValidationError

        raise SchemaValidationError(
            "tutor response failed schema validation",
            details={"trace_id": session.trace_id, "error": str(exc)},
        ) from exc

    if state.acting_user_id and state.lesson_id:
        try:
            tool_memory_upsert(
                user_id=state.acting_user_id,
                lesson_id=state.lesson_id,
                text=content,
            )
        except MemoryError as exc:
            logger.warning("[GENERATE] memory upsert failed: %s", exc.message)

    return state


def build_graph():
    graph = StateGraph(GenerateContentMaterialPipeline)
    graph.add_node("parallel_fetch", parallel_fetch)
    graph.add_node("prepare_learning_context", prepare_learning_context)
    graph.add_node("generate_material", generate_material)

    graph.add_edge(START, "parallel_fetch")
    graph.add_edge("parallel_fetch", "prepare_learning_context")
    graph.add_edge("prepare_learning_context", "generate_material")
    graph.add_edge("generate_material", END)
    return graph.compile()


_GRAPH = build_graph()


def generate_content_material_pipeline(
    state: GenerateContentMaterialPipeline,
) -> GenerateContentMaterialPipeline:
    session = _session(state)
    result = _GRAPH.invoke(state)
    update_message_chat(
        state.message_id,
        session,
        {"text": "Content material generation completed successfully!", "status": "COMPLETED"},
    )
    return result


__all__ = [
    "parallel_fetch",
    "prepare_learning_context",
    "retrieve_material_rag",
    "retrieve_material_web",
    "generate_material",
    "build_graph",
    "generate_content_material_pipeline",
    "GenerateContentMaterialResponseDto",
]