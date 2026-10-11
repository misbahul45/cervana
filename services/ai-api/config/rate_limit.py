

import inspect
import logging
from collections import defaultdict
from functools import wraps
from threading import Lock
import time
from typing import Any, Callable, Optional, Tuple

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from config.envs import ENVS
from config.redis_client import get_redis_client


WINDOW_SECONDS = 60

logger = logging.getLogger(__name__)


class _Bucket:
    __slots__ = ("tokens", "last_refill")

    def __init__(self, capacity: float, burst: float, last_refill: float):
        self.tokens = max(0.0, capacity - burst)
        self.last_refill = last_refill


class RateLimiter:
    def __init__(
        self,
        capacity_per_minute: int = 60,
        burst: int = 10,
        redis_client=None,
        redis_provider: Optional[Callable[[], Any]] = None,
    ):
        self.capacity = float(capacity_per_minute)
        self.refill_rate = self.capacity / 60.0
        self.burst = float(burst)
        self.redis_client = redis_client
        self.redis_provider = redis_provider
        self._local: dict[str, _Bucket] = defaultdict(lambda: _Bucket(self.capacity, self.burst, time.time()))
        self._lock = Lock()

    def check(self, key: str) -> Tuple[bool, float]:
        client = self._redis()
        if client is not None:
            try:
                return self._check_shared(client, key)
            except Exception as exc:
                logger.warning("[RATE_LIMIT] shared limiter unavailable, using the local one: %s", exc)
        return self._check_local(key)

    def _redis(self):
        if self.redis_client is not None:
            return self.redis_client
        if self.redis_provider is not None:
            return self.redis_provider()
        return None

    def _check_shared(self, client, key: str) -> Tuple[bool, float]:
        now = time.time()
        window = int(now // WINDOW_SECONDS)
        name = f"ratelimit:{key}:{window}"
        pipeline = client.pipeline(transaction=True)
        pipeline.incr(name)
        pipeline.expire(name, WINDOW_SECONDS * 2)
        count, _ = pipeline.execute()
        if count <= int(self.capacity + self.burst):
            return True, 0.0
        return False, (window + 1) * WINDOW_SECONDS - now

    def _check_local(self, key: str) -> Tuple[bool, float]:
        now = time.time()
        with self._lock:
            bucket = self._local[key]
            elapsed = max(0.0, now - bucket.last_refill)
            bucket.tokens = min(
                self.capacity + self.burst,
                bucket.tokens + elapsed * self.refill_rate,
            )
            bucket.last_refill = now
            if bucket.tokens >= 1.0:
                bucket.tokens -= 1.0
                return True, max(0.0, (1.0 - bucket.tokens) / self.refill_rate)
            return False, (1.0 - bucket.tokens) / self.refill_rate


_default_limiter: Optional[RateLimiter] = None


def get_default_limiter() -> RateLimiter:
    global _default_limiter
    if _default_limiter is None:
        _default_limiter = RateLimiter(
            capacity_per_minute=int(ENVS.get("AI_API_RATE_LIMIT", 60)),
            burst=int(ENVS.get("AI_API_RATE_BURST", 10)),
            redis_provider=get_redis_client,
        )
    return _default_limiter


def rate_limit_subject(request: Request, kwargs: dict) -> str:
    user = kwargs.get("user")
    if isinstance(user, dict) and user.get("id"):
        return f"user:{user['id']}"
    return f"ip:{request.client.host if request.client else 'unknown'}"


def rate_limit(capacity_per_minute: int = 60, burst: int = 10):
    def decorator(func: Callable):
        if "request" not in inspect.signature(func).parameters:
            raise TypeError(
                f"{func.__qualname__} must declare a 'request: Request' parameter to be rate limited"
            )
        limiter = RateLimiter(
            capacity_per_minute=capacity_per_minute,
            burst=burst,
            redis_provider=get_redis_client,
        )
        @wraps(func)
        async def wrapper(*args, **kwargs):
            request: Optional[Request] = kwargs.get("request")
            if request is None and args:
                for a in args:
                    if isinstance(a, Request):
                        request = a
                        break
            if request is None:
                return await func(*args, **kwargs)

            key = f"{rate_limit_subject(request, kwargs)}:{func.__qualname__}"
            allowed, retry_after = limiter.check(key)
            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content={
                        "code": "RATE_LIMITED",
                        "message": f"Rate limit exceeded for {func.__qualname__}",
                        "retryAfterSeconds": round(retry_after, 2),
                    },
                    headers={"Retry-After": str(int(retry_after) + 1)},
                )
            return await func(*args, **kwargs)

        wrapper.__rate_limited__ = True
        return wrapper

    return decorator