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


class FakePipeline:
    def __init__(self, redis):
        self.redis = redis
        self.commands = []

    def incr(self, name):
        self.commands.append(("incr", name))
        return self

    def expire(self, name, seconds):
        self.commands.append(("expire", name, seconds))
        return self

    def execute(self):
        self.redis.guard()
        results = []
        for command, *args in self.commands:
            results.append(getattr(self.redis, command)(*args))
        self.commands = []
        return results


class FakeRedis:
    def __init__(self, clock=None):
        import time

        self.clock = clock or time.time
        self.values = {}
        self.deadlines = {}
        self.unavailable = False

    def guard(self):
        if self.unavailable:
            raise ConnectionError("redis unavailable")

    def alive(self, name):
        deadline = self.deadlines.get(name)
        if deadline is not None and self.clock() >= deadline:
            self.values.pop(name, None)
            self.deadlines.pop(name, None)
        return name in self.values

    def set(self, name, value, nx=False, ex=None):
        self.guard()
        if nx and self.alive(name):
            return None
        self.values[name] = value
        if ex is None:
            self.deadlines.pop(name, None)
        else:
            self.deadlines[name] = self.clock() + ex
        return True

    def get(self, name):
        self.guard()
        return self.values[name] if self.alive(name) else None

    def delete(self, *names):
        self.guard()
        removed = 0
        for name in names:
            if self.alive(name):
                removed += 1
            self.values.pop(name, None)
            self.deadlines.pop(name, None)
        return removed

    def incr(self, name):
        self.guard()
        current = int(self.values[name]) if self.alive(name) else 0
        self.values[name] = str(current + 1)
        return current + 1

    def expire(self, name, seconds):
        self.guard()
        if not self.alive(name):
            return False
        self.deadlines[name] = self.clock() + seconds
        return True

    def pipeline(self, transaction=True):
        return FakePipeline(self)


@pytest.fixture
def fake_redis():
    from config.redis_client import configure_redis_client

    redis = FakeRedis()
    configure_redis_client(redis)
    yield redis
    configure_redis_client(None)


@pytest.fixture(autouse=True)
def isolated_redis_client():
    from config.redis_client import configure_redis_client

    configure_redis_client(None)
    yield
    configure_redis_client(None)


class InternalWire:
    def __init__(self, monkeypatch):
        self.sent = []
        self.status = 200
        self.body = {"data": None}
        self.error = None
        monkeypatch.setenv("INTERNAL_AI_API_SECRET", "wire-test-secret")
        monkeypatch.setattr("requests.Session.send", self.transport)

    def respond(self, status=200, body=None, error=None):
        self.status = status
        self.body = body if body is not None else {"data": None}
        self.error = error
        return self

    def transport(self, prepared, **kwargs):
        import json as _json

        import requests as _requests

        self.sent.append(prepared)
        if self.error is not None:
            raise self.error
        reply = _requests.Response()
        reply.status_code = self.status
        reply._content = _json.dumps(self.body).encode()
        return reply

    def json_of(self, prepared):
        import json as _json

        return _json.loads(prepared.body)


@pytest.fixture
def internal_wire(monkeypatch):
    return InternalWire(monkeypatch)
