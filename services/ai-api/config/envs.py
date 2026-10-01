import os
from typing import TypedDict
from dotenv import load_dotenv

load_dotenv()

class ENVConfig(TypedDict):
    PORT: int
    APP_VERSION: str
    NEST_API: str
    QDRANT_API_KEY: str
    QDRANT_URL: str
    QDRANT_COLLECTION: str
    QDRANT_MEMORY_COLLECTION: str
    OPENAI_API_KEY: str
    OPENAI_BASE_URL: str
    OPENAI_MODEL_FLASH: str
    OPENAI_MODEL_THINKING: str
    OPENAI_MAX_TOKENS: int
    OPENAI_THINKING_MAX_TOKENS: int
    OPENAI_FLASH_TEMPERATURE: float | None
    HF_TOKEN: str
    HF_EMBEDDING_MODEL: str
    HF_EMBEDDING_URL: str
    EMBEDDING_DIM: int
    WEB_URL: str
    ADMIN_URL: str
    TAVILY_API_KEY: str
    REDIS_URL: str
    CELERY_BROKER_URL: str
    CELERY_RESULT_BACKEND: str


ENVS: ENVConfig = {
    "PORT": int(os.getenv("PORT", 3003)),
    "APP_VERSION": os.getenv("APP_VERSION", "v1"),
    "NEST_API": os.getenv("NEST_API", "http://api:3002/api/v1"),
    "QDRANT_API_KEY": os.getenv("QDRANT_API_KEY", ""),
    "QDRANT_URL": os.getenv("QDRANT_URL", ""),
    "QDRANT_COLLECTION": os.getenv("QDRANT_COLLECTION", "reducera-embedding"),
    "OPENAI_API_KEY": os.getenv("OPENAI_API_KEY", ""),
    "OPENAI_BASE_URL": os.getenv("OPENAI_BASE_URL") or "https://api.openai.com/v1",
    "OPENAI_MODEL_FLASH": os.getenv("OPENAI_MODEL_FLASH") or "gpt-4.1-mini",
    "OPENAI_MODEL_THINKING": os.getenv("OPENAI_MODEL_THINKING") or "gpt-5-mini",
    "OPENAI_MAX_TOKENS": int(os.getenv("OPENAI_MAX_TOKENS") or 8192),
    "OPENAI_THINKING_MAX_TOKENS": int(os.getenv("OPENAI_THINKING_MAX_TOKENS") or 16000),
    "OPENAI_FLASH_TEMPERATURE": float(os.getenv("OPENAI_FLASH_TEMPERATURE"))
    if os.getenv("OPENAI_FLASH_TEMPERATURE")
    else None,
    "HF_TOKEN": os.getenv("HF_TOKEN", ""),
    "HF_EMBEDDING_MODEL": os.getenv("HF_EMBEDDING_MODEL") or "BAAI/bge-m3",
    "HF_EMBEDDING_URL": os.getenv("HF_EMBEDDING_URL")
    or "https://router.huggingface.co/hf-inference/models/{model}/pipeline/feature-extraction",
    "EMBEDDING_DIM": int(os.getenv("EMBEDDING_DIM") or 1024),
    "WEB_URL": os.getenv("WEB_URL", "http://web:3000"),
    "ADMIN_URL": os.getenv("ADMIN_URL", "http://localhost/admin"),
    "QDRANT_MEMORY_COLLECTION": os.getenv("QDRANT_MEMORY_COLLECTION", "reducera-memory"),
    "TAVILY_API_KEY": os.getenv("TAVILY_API_KEY", ""),
    "REDIS_URL": os.getenv("REDIS_URL", "redis://redis:6379/0"),
    "CELERY_BROKER_URL": os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0"),
    "CELERY_RESULT_BACKEND": os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/0"),
}


