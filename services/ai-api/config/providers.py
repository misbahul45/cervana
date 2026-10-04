import logging
import time
from typing import List

import numpy as np
import requests
from langchain_openai import ChatOpenAI
from llama_index.core.base.embeddings.base import BaseEmbedding

from config.envs import ENVS

logger = logging.getLogger("providers")

RETRY_STATUSES = frozenset({429, 500, 502, 503, 504})
MAX_ATTEMPTS = 3
BACKOFF_SECONDS = 2.0
REQUEST_TIMEOUT_SECONDS = 60
LLM_TIMEOUT_SECONDS = 60
LLM_MAX_RETRIES = 2
EMBED_BATCH_SIZE = 32


def resolve_embedding_endpoint(url_template: str, model: str) -> str:
    return url_template.replace("{model}", model)


class HuggingFaceEmbedding(BaseEmbedding):
    endpoint: str
    token: str
    dimensions: int

    @classmethod
    def class_name(cls) -> str:
        return "HuggingFaceEmbedding"

    def _request(self, texts: List[str]) -> np.ndarray:
        if not self.token:
            raise RuntimeError("HF_TOKEN is not set")

        last_error: Exception | None = None
        for attempt in range(1, MAX_ATTEMPTS + 1):
            try:
                response = requests.post(
                    self.endpoint,
                    headers={"Authorization": f"Bearer {self.token}"},
                    json={"inputs": texts},
                    timeout=REQUEST_TIMEOUT_SECONDS,
                )
            except requests.RequestException as exc:
                last_error = exc
            else:
                if response.status_code in RETRY_STATUSES:
                    last_error = RuntimeError(
                        f"HF embedding endpoint returned {response.status_code}"
                    )
                elif response.status_code >= 400:
                    raise RuntimeError(
                        f"HF embedding request failed with {response.status_code}"
                    )
                else:
                    return self._to_matrix(response.json(), len(texts))

            if attempt < MAX_ATTEMPTS:
                time.sleep(BACKOFF_SECONDS * attempt)

        raise RuntimeError(
            f"HF embedding request failed after {MAX_ATTEMPTS} attempts"
        ) from last_error

    def _to_matrix(self, payload, expected_rows: int) -> np.ndarray:
        if isinstance(payload, dict):
            raise RuntimeError("HF embedding endpoint returned an error payload")

        matrix = np.asarray(payload, dtype=float)
        if matrix.ndim == 1:
            matrix = matrix.reshape(1, -1)
        if matrix.ndim == 3:
            matrix = matrix.mean(axis=1)
        if matrix.ndim != 2 or matrix.shape[0] != expected_rows:
            raise RuntimeError(f"unexpected embedding shape {matrix.shape}")
        if matrix.shape[1] != self.dimensions:
            raise RuntimeError(
                f"embedding dimension {matrix.shape[1]} does not match "
                f"EMBEDDING_DIM={self.dimensions}"
            )
        return matrix

    def _get_query_embedding(self, query: str) -> List[float]:
        return self._request([query])[0].tolist()

    def _get_text_embedding(self, text: str) -> List[float]:
        return self._request([text])[0].tolist()

    def _get_text_embeddings(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        return [row.tolist() for row in self._request(texts)]

    async def _aget_query_embedding(self, query: str) -> List[float]:
        return self._get_query_embedding(query)

    async def _aget_text_embedding(self, text: str) -> List[float]:
        return self._get_text_embedding(text)


def build_embedding_model() -> HuggingFaceEmbedding:
    model = ENVS["HF_EMBEDDING_MODEL"]
    return HuggingFaceEmbedding(
        model_name=model,
        endpoint=resolve_embedding_endpoint(ENVS["HF_EMBEDDING_URL"], model),
        token=ENVS["HF_TOKEN"],
        dimensions=ENVS["EMBEDDING_DIM"],
        embed_batch_size=EMBED_BATCH_SIZE,
    )


def build_chat_model(mode: str = "flash") -> ChatOpenAI:
    if not ENVS["OPENAI_API_KEY"]:
        logger.warning("OPENAI_API_KEY is not set, LLM calls will fail")

    if mode == "thinking":
        return ChatOpenAI(
            api_key=ENVS["OPENAI_API_KEY"],
            base_url=ENVS["OPENAI_BASE_URL"],
            model=ENVS["OPENAI_MODEL_THINKING"],
            max_tokens=ENVS["OPENAI_THINKING_MAX_TOKENS"],
        )

    options = {}
    if ENVS["OPENAI_FLASH_TEMPERATURE"] is not None:
        options["temperature"] = ENVS["OPENAI_FLASH_TEMPERATURE"]
    return ChatOpenAI(
        api_key=ENVS["OPENAI_API_KEY"],
        base_url=ENVS["OPENAI_BASE_URL"],
        model=ENVS["OPENAI_MODEL_FLASH"],
        max_tokens=ENVS["OPENAI_MAX_TOKENS"],
        **options,
    )
