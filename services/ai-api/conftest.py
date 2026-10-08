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

collect_ignore = ["utils/tools/__tests__/test_memory.py"]

import pytest


class ScriptedLLM:
    def __init__(self):
        self.replies = {"flash": [], "thinking": []}
        self.calls = []

    def reply(self, mode, *items):
        self.replies[mode].extend(items)
        return self

    def fail(self, mode, message="scripted failure"):
        return self.reply(mode, RuntimeError(message))

    def factory(self, mode, route=None):
        script = self

        class Model:
            def invoke(self, messages, **kwargs):
                from langchain_core.messages import AIMessage

                script.calls.append((mode, route, messages))
                queue = script.replies[mode]
                if not queue:
                    raise RuntimeError(f"no scripted {mode} reply left")
                item = queue.pop(0)
                if isinstance(item, Exception):
                    raise item
                return item if not isinstance(item, str) else AIMessage(content=item)

        return Model()


@pytest.fixture
def scripted_llm():
    from config.model_router import ModelRouter, RoutingPolicy, configure_router

    script = ScriptedLLM()
    configure_router(ModelRouter(RoutingPolicy(version="routing-test"), model_factory=script.factory))
    yield script
    configure_router(None)
