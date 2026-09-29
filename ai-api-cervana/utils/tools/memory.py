from config.memory_embedding import MemoryManager
from datetime import datetime
import logging
from config.embedding_pipeline import get_embedding_pipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

embed_pipeline = get_embedding_pipeline()
memory_manager = MemoryManager(embed_model=embed_pipeline.embed_model)


def tool_semantic_search(userId: str, lessonId: str, top_k: int = 15):
    """
    Retrieve user semantic memory strictly filtered by lessonId.
    Returns empty list when no lesson-scoped memory exists.
    Cross-lesson leakage is forbidden; the caller decides whether
    to fall back (allow_fallback=True) or accept the empty result.
    """
    return _semantic_search(userId=userId, lessonId=lessonId, top_k=top_k, allow_fallback=False)


def tool_semantic_search_with_fallback(
    userId: str, lessonId: str, top_k: int = 15, fallback_limit: int = 5
):
    """
    Like tool_semantic_search, but if no lesson-scoped memory exists,
    returns up to fallback_limit recent items regardless of lesson.
    The fallback is logged at WARNING level so it can be monitored.
    """
    return _semantic_search(
        userId=userId,
        lessonId=lessonId,
        top_k=top_k,
        allow_fallback=True,
        fallback_limit=fallback_limit,
    )


def _semantic_search(
    userId: str,
    lessonId: str,
    top_k: int,
    allow_fallback: bool,
    fallback_limit: int = 0,
):
    try:
        items = memory_manager.retrieve(
            user_id=userId,
            top_k=top_k,
            memory_type="learning_path",
        )

        filtered = [
            m for m in items
            if m.get("metadata", {}).get("lessonId") == lessonId
            or m.get("metadata", {}).get("lesson_id") == lessonId
        ]

        if filtered:
            return filtered

        if allow_fallback:
            logger.warning(
                f"Cross-lesson memory fallback used for userId={userId} lessonId={lessonId}; "
                f"returning {min(fallback_limit, len(items))} unrelated items"
            )
            return items[:fallback_limit]

        logger.info(
            f"No lesson-scoped memory for userId={userId} lessonId={lessonId}; "
            f"returning empty list (allow_fallback={allow_fallback})"
        )
        return []

    except Exception as e:
        logger.error(f"Error retrieving memory: {e}")
        return []


def tool_memory_upsert(userId: str, lessonId: str, text: str):
    """
    Store a memory entry for a specific user + lesson.
    """
    try:
        memory_manager.upsert(
            user_id=userId,
            text=text,
            memory_type="learning_path",
            metadata={
                "lessonId": lessonId,
                "timestamp": datetime.utcnow().isoformat(),
            },
        )
    except Exception as e:
        logger.error(f"Error upserting memory: {e}")


def tool_memory_read(userId: str, lessonId: str | None = None, limit: int = 20):
    """
    Read raw user memory history with optional lesson filtering.
    """
    try:
        items = memory_manager.retrieve(
            user_id=userId,
            top_k=limit,
            memory_type="learning_path",
        )

        if lessonId:
            items = [
                m for m in items
                if m.get("metadata", {}).get("lessonId") == lessonId
                or m.get("metadata", {}).get("lesson_id") == lessonId
            ]

        try:
            items.sort(
                key=lambda x: x.get("metadata", {}).get("timestamp", ""),
                reverse=True,
            )
        except Exception:
            pass

        return items[:limit]

    except Exception as e:
        logger.error(f"Error reading memory: {e}")
        return []