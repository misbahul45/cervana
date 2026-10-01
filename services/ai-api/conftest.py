"""Top-level pytest configuration.

Loads required env vars before any module is imported, so
config.envs.ENVS is populated even when tests don't touch main.py.
"""

import os

os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ.setdefault("QDRANT_URL", "http://localhost:6333")
os.environ.setdefault("QDRANT_COLLECTION", "test-collection")
os.environ.setdefault(
    "QDRANT_MEMORY_COLLECTION", "test-memory-collection"
)
os.environ.setdefault("NEST_API", "http://localhost:3002/api/v1")
os.environ.setdefault("ADMIN_URL", "http://localhost:3001")
os.environ.setdefault("WEB_URL", "http://localhost:3000")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("CELERY_BROKER_URL", "redis://localhost:6379/0")
os.environ.setdefault(
    "CELERY_RESULT_BACKEND", "redis://localhost:6379/0"
)
os.environ.setdefault("TAVILY_API_KEY", "")
os.environ.setdefault("PORT", "3003")
os.environ.setdefault("APP_VERSION", "v1")
os.environ.setdefault(
    "RESOURCE_ALLOWLIST_SCHEMES", "https,http"
)