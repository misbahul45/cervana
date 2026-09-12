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
    Retrieve user semantic memory related to learning_path,
    filtered by lessonId when available.
    """
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
        return items[:5]

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
