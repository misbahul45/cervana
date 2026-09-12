import os
import re
import json
import hashlib
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
import numpy as np

from llama_index.core import Document, VectorStoreIndex, StorageContext
from llama_index.core.node_parser import SemanticSplitterNodeParser
from llama_index.vector_stores.qdrant import QdrantVectorStore
from llama_index.embeddings.gemini import GeminiEmbedding
from langchain_google_genai import ChatGoogleGenerativeAI
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, Filter, FieldCondition, MatchValue
from llama_index.core.schema import TextNode
from llama_index.core.vector_stores import (
    MetadataFilter,
    MetadataFilters,
    FilterOperator,
)

from config.envs import ENVS
from llama_index.core.node_parser import SentenceSplitter

logger = logging.getLogger("embedding_pipeline")
logger.setLevel(logging.INFO)

QDRANT_URL = ENVS["QDRANT_URL"]
QDRANT_API_KEY = ENVS["QDRANT_API_KEY"]
COLLECTION_NAME = ENVS["QDRANT_COLLECTION"]
GOOGLE_API_KEY = ENVS["GEMINI_API_KEY"]

EMBED_MODEL_NAME = "models/embedding-001"
CHAT_MODEL_NAME = "gemini-2.5-flash"
RETRIEVAL_K = 20


# ==========================
# UTILITY CHUNKING
# ==========================

def structural_split(text: str) -> list[str]:
    return [chunk.strip() for chunk in text.split('\n\n') if chunk.strip()]

def adaptive_chunks(text: str) -> list[str]:
    return SentenceSplitter(chunk_size=512, chunk_overlap=20).split_text(text)


# ==========================
# INIT QDRANT
# ==========================

qdrant_client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)

try:
    collections = [c.name for c in qdrant_client.get_collections().collections]
    if COLLECTION_NAME not in collections:
        qdrant_client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=768, distance=Distance.COSINE),
        )
except Exception as e:
    logger.error(f"Qdrant initialization failed: {e}")

vector_store = QdrantVectorStore(client=qdrant_client, collection_name=COLLECTION_NAME)
storage_context = StorageContext.from_defaults(vector_store=vector_store)

embed_model = GeminiEmbedding(model_name=EMBED_MODEL_NAME, api_key=GOOGLE_API_KEY)
llm_model = ChatGoogleGenerativeAI(model=CHAT_MODEL_NAME, google_api_key=GOOGLE_API_KEY, temperature=0.2)


# ==========================
# SMART CHUNKER
# ==========================

class SmartChunker:
    def __init__(self, embed_model=None):
        self.semantic_splitter = SemanticSplitterNodeParser.from_defaults(
            buffer_size=2,
            breakpoint_percentile_threshold=90,
            embed_model=embed_model
        )

    def chunk(self, text: str) -> list[str]:
        structural_chunks = structural_split(text)
        final_chunks = []

        for chunk in structural_chunks:
            semantic_chunks = self.semantic_split(chunk)

            if not semantic_chunks or len(semantic_chunks) < 2:
                semantic_chunks = adaptive_chunks(chunk)

            final_chunks.extend(semantic_chunks)

        return final_chunks

    def semantic_split(self, text: str) -> list[str]:
        nodes = self.semantic_splitter.get_nodes_from_documents([Document(text=text)])
        return [n.text for n in nodes if len(n.text.strip()) > 30]


# ==========================
# MAIN PIPELINE (UPDATED)
# ==========================

class EmbeddingPipeline:
    def __init__(
        self,
        enable_thinking: bool = True,
        enable_retrieval: bool = True,
        enable_translation: bool = True,
    ):
        self.enable_thinking = enable_thinking
        self.enable_retrieval = enable_retrieval
        self.enable_translation = enable_translation

        self.embed_model = embed_model
        self.llm = llm_model
        self.vector_store = vector_store
        self.storage_context = storage_context
        self.smart_chunker = SmartChunker(embed_model=self.embed_model)

        self.index = self._load_or_create_index()

    # ---------------------------
    # INIT INDEX
    # ---------------------------
    def _load_or_create_index(self) -> VectorStoreIndex:
        try:
            return VectorStoreIndex.from_vector_store(
                self.vector_store,
                embed_model=self.embed_model
            )
        except Exception:
            return VectorStoreIndex.from_documents(
                [],
                storage_context=self.storage_context,
                embed_model=self.embed_model
            )

    # ---------------------------
    # HELPERS
    # ---------------------------

    @staticmethod
    def _get_md5_hash(text: str) -> str:
        return hashlib.md5(text.encode()).hexdigest()

    def clean_text(self, text: str) -> str:
        return re.sub(r'\s+', ' ', text).strip()

    # ---------------------------
    # TRANSLATION CONTROL
    # ---------------------------

    def translate(self, text: str) -> str:
        if not self.enable_translation:
            return text

        prompt = f"Translate to English:\n{text}"
        response = self.llm.invoke([{"role": "user", "content": prompt}])
        return response.content.strip()

    # ---------------------------
    # LLM CONTROL — THINKING MODE
    # ---------------------------

    def llm_prompt(self, prompt: str) -> str:
        """
        Mode thinking hanya menambah kualitas reasoning internal,
        tanpa menampilkan chain-of-thought.
        """

        if self.enable_thinking:
            system_prompt = (
                "Gunakan penalaran mendalam secara internal tanpa menampilkan proses berpikir. "
                "Berikan jawaban akhir yang terstruktur, akurat, dan ringkas."
            )
        else:
            system_prompt = (
                "Jawab langsung, ringkas, dan tanpa penjelasan panjang."
            )

        response = self.llm.invoke([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ])

        return response.content.strip()

    # ---------------------------
    # UPSERT DOCUMENT
    # ---------------------------
    def upsert_document(self, content: str, source_id: str, metadata=None):
        cleaned = self.clean_text(content)

            # Translation jika diaktifkan
        if self.enable_translation:
            cleaned = self.translate(cleaned)

        # Chunking
        chunks = self.smart_chunker.chunk(cleaned)
        nodes = []

        # 👇 ikuti contoh persis seperti TextNode()
        for i, chunk in enumerate(chunks):
            node = TextNode(
                text=chunk,
                metadata={
                    "source": source_id,
                    "chunk_index": i,
                    **(metadata or {})
                },
            )
            nodes.append(node)

        # Masukkan nodes ke vectorstore
        VectorStoreIndex.from_documents(
            nodes,
            storage_context=self.storage_context,
            embed_model=self.embed_model,
        )

        logger.info(f"[UPSERT] Inserted {len(nodes)} chunks for {source_id}")
    # ---------------------------
    # RETRIEVAL (CAN BE DISABLED)
    # ---------------------------
    def retrieve(self, query: str, metadata_filter=None, top_k: int = RETRIEVAL_K):
        if not self.enable_retrieval:
            return []

        if self.enable_translation:
            query = self.translate(query)

        filters = None

        retriever = self.index.as_retriever(
            similarity_top_k=top_k,
            filters=filters,
        )

        results = retriever.retrieve(query)

        # Return TextNode saja
        return [
            {
                "score": float(item.score),
                "text": item.node.text,       # convenience
                "metadata": item.node.metadata
            }
            for item in results
        ]
# SINGLETON INSTANCE
PIPELINE_INSTANCE = EmbeddingPipeline()

def get_embedding_pipeline() -> EmbeddingPipeline:
    return PIPELINE_INSTANCE
