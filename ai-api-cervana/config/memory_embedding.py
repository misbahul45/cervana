import logging
import re
from datetime import datetime
from typing import Optional

from llama_index.core import Document, VectorStoreIndex, StorageContext
from llama_index.vector_stores.qdrant import QdrantVectorStore
from llama_index.core.vector_stores import (
    MetadataFilter,
    MetadataFilters,
    FilterOperator,
)

from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance

from config.envs import ENVS


logger = logging.getLogger("memory_manager")
logger.setLevel(logging.INFO)

QDRANT_URL = ENVS["QDRANT_URL"]
QDRANT_API_KEY = ENVS["QDRANT_API_KEY"]
MEMORY_COLLECTION = ENVS["QDRANT_MEMORY_COLLECTION"]
VECTOR_SIZE = 768

qdrant_client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
collections = [c.name for c in qdrant_client.get_collections().collections]

if MEMORY_COLLECTION not in collections:
    qdrant_client.create_collection(
        collection_name=MEMORY_COLLECTION,
        vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
    )

memory_vector_store = QdrantVectorStore(
    client=qdrant_client,
    collection_name=MEMORY_COLLECTION,
)

memory_storage_context = StorageContext.from_defaults(
    vector_store=memory_vector_store
)


class MemoryManager:
    def __init__(self, embed_model):
        self.embed_model = embed_model
        self.vector_store = memory_vector_store
        self.storage_context = memory_storage_context

        try:
            self.index = VectorStoreIndex.from_vector_store(
                self.vector_store,
                embed_model=self.embed_model,
            )
        except Exception:
            self.index = VectorStoreIndex.from_documents(
                [],
                storage_context=self.storage_context,
                embed_model=self.embed_model,
            )

    def upsert(
        self,
        user_id: str,
        text: str,
        memory_type: str = "general",
        metadata: Optional[dict] = None,
    ):
        cleaned = re.sub(r"\s+", " ", text).strip()
        payload = {
            "userId": user_id,
            "memory_type": memory_type,
            "timestamp": datetime.utcnow().isoformat(),
            **(metadata or {}),
        }

        doc = Document(text=cleaned, metadata=payload)

        VectorStoreIndex.from_documents(
            [doc],
            storage_context=self.storage_context,
            embed_model=self.embed_model,
        )

        logger.info("[MEMORY UPSERT] inserted memory for user=%s", user_id)

    def retrieve(
        self,
        user_id: str,
        top_k: int = 10,
        memory_type: Optional[str] = None,
    ):
        filters = [
            MetadataFilter(key="userId", value=user_id, operator=FilterOperator.EQ)
        ]

        if memory_type:
            filters.append(
                MetadataFilter(key="memory_type", value=memory_type, operator=FilterOperator.EQ)
            )

        metadata_filters = MetadataFilters(filters=filters)

        retriever = self.index.as_retriever(
            similarity_top_k=top_k,
            filters=metadata_filters,
        )

        try:
            nodes = retriever.retrieve("memory_query")
        except Exception as error:
            logger.error("Error retrieving memory: %s", error)
            return []

        results = []
        for x in nodes:
            results.append({
                "score": float(x.score),
                "text": x.node.text,
                "metadata": x.node.metadata,
            })

        return results

    def retrieve_as_string(
        self,
        user_id: str,
        top_k: int = 10,
        memory_type: Optional[str] = None,
    ) -> str:
        items = self.retrieve(user_id, top_k, memory_type)
        if not items:
            return ""
        return "\n".join([x["text"] for x in items])
