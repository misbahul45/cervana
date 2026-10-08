

import inspect
from collections import defaultdict
from functools import wraps
from threading import Lock
import time
from typing import Callable, Optional, Tuple

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from config.envs import ENVS

try:
    import redis as redis_lib
except ImportError:
    redis_lib = None


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
    ):
        self.capacity = float(capacity_per_minute)
        self.refill_rate = self.capacity / 60.0
        self.burst = float(burst)
        self.redis_client = redis_client
        self._local: dict[str, _Bucket] = defaultdict(lambda: _Bucket(self.capacity, self.burst, time.time()))
        self._lock = Lock()

    def check(self, key: str) -> Tuple[bool, float]:
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
        redis_url = ENVS.get("REDIS_URL")
        client = None
        if redis_url and redis_lib is not None:
            try:
                client = redis_lib.Redis.from_url(
                    redis_url, decode_responses=True
                )
                client.ping()
            except Exception:
                client = None
        _default_limiter = RateLimiter(
            capacity_per_minute=int(ENVS.get("AI_API_RATE_LIMIT", 60)),
            burst=int(ENVS.get("AI_API_RATE_BURST", 10)),
            redis_client=client,
        )
    return _default_limiter


def rate_limit(capacity_per_minute: int = 60, burst: int = 10):
    def decorator(func: Callable):
        if "request" not in inspect.signature(func).parameters:
            raise TypeError(
                f"{func.__qualname__} must declare a 'request: Request' parameter to be rate limited"
            )
        limiter = RateLimiter(capacity_per_minute=capacity_per_minute, burst=burst)
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

            client_host = request.client.host if request.client else "unknown"
            key = f"{client_host}:{func.__qualname__}"
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