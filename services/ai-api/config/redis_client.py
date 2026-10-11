from __future__ import annotations

from typing import Any

from config.envs import ENVS

try:
    import redis as redis_lib
except ImportError:
    redis_lib = None


SOCKET_TIMEOUT_SECONDS = 1.0

_UNSET = object()
_client: Any = _UNSET


def configure_redis_client(client: Any) -> None:
    global _client
    _client = client


def get_redis_client() -> Any:
    global _client
    if _client is _UNSET:
        url = ENVS.get("REDIS_URL")
        if url and redis_lib is not None:
            _client = redis_lib.Redis.from_url(
                url,
                decode_responses=True,
                socket_connect_timeout=SOCKET_TIMEOUT_SECONDS,
                socket_timeout=SOCKET_TIMEOUT_SECONDS,
            )
        else:
            _client = None
    return _client


__all__ = ["configure_redis_client", "get_redis_client"]
