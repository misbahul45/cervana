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
    GEMINI_API_KEY: str
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
    "QDRANT_COLLECTION": os.getenv("QDRANT_COLLECTION", "cervana-embedding"),
    "GEMINI_API_KEY": os.getenv("GEMINI_API_KEY", ""),
    "WEB_URL": os.getenv("WEB_URL", "http://web:3000"),
    "ADMIN_URL": os.getenv("ADMIN_URL", "http://admin:3001"),
    "QDRANT_MEMORY_COLLECTION": os.getenv("QDRANT_MEMORY_COLLECTION", "cervana-memory"),
    "TAVILY_API_KEY": os.getenv("TAVILY_API_KEY", ""),
    "REDIS_URL": os.getenv("REDIS_URL", "redis://redis:6379/0"),
    "CELERY_BROKER_URL": os.getenv("CELERY_BROKER_URL", "redis://redis:6379/0"),
    "CELERY_RESULT_BACKEND": os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/0"),
}


