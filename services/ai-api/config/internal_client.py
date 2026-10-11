from __future__ import annotations

import hashlib
import json
import logging
from typing import Any

import requests

from config.agent_session import AgentSession
from config.envs import ENVS
from config.service_auth import send_signed
from errors.types import AuthError, CrossServiceError

API_TIMEOUT_SECONDS = 15
READ_METHODS = {"GET", "HEAD"}
ERROR_BODY_LIMIT = 500

logger = logging.getLogger(__name__)


def _operation_key(session_key: str, method: str, path: str, body: dict | None) -> str:
    material = "\0".join(
        [session_key, method.upper(), path, json.dumps(body, sort_keys=True, separators=(",", ":"))]
    )
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


class InternalApiClient:
    def __init__(self, session: AgentSession, *, timeout: int = API_TIMEOUT_SECONDS):
        self.session = session
        self.timeout = timeout

    def send(
        self,
        method: str,
        path: str,
        *,
        params: dict | None = None,
        json_body: dict | None = None,
    ) -> dict:
        url = f"{ENVS['NEST_API']}{path}"
        idempotency_key = None
        if method.upper() not in READ_METHODS:
            idempotency_key = _operation_key(self.session.idempotency_key, method, path, json_body)

        logger.info(
            "[INTERNAL][%s] %s acting=%s trace=%s",
            method.upper(),
            url,
            self.session.acting_user_id,
            self.session.trace_id,
        )

        try:
            response = send_signed(
                method,
                url,
                json_body=json_body,
                params=params,
                trace_id=self.session.trace_id,
                idempotency_key=idempotency_key,
                acting_user_id=self.session.acting_user_id,
                timeout=self.timeout,
            )
        except RuntimeError as exc:
            raise CrossServiceError(
                "internal service secret is not configured",
                details={"url": url, "reason": "service_secret_missing", "error": str(exc)},
            ) from exc
        except requests.RequestException as exc:
            raise CrossServiceError(
                "failed to reach internal api",
                details={"url": url, "error": str(exc)},
            ) from exc

        return self._unwrap(response, url)

    def get(self, path: str, *, params: dict | None = None) -> Any:
        return self.send("GET", path, params=params).get("data")

    def post(self, path: str, *, json_body: dict) -> Any:
        return self.send("POST", path, json_body=json_body).get("data")

    def patch(self, path: str, *, json_body: dict) -> Any:
        return self.send("PATCH", path, json_body=json_body).get("data")

    @staticmethod
    def _unwrap(response: requests.Response, url: str) -> dict:
        status = response.status_code
        if status < 400:
            return response.json()

        details = {"url": url, "status": status}
        if status >= 500:
            raise CrossServiceError("internal api error", details=details)
        if status == 401:
            raise CrossServiceError(
                "internal api rejected the service credentials",
                details={**details, "reason": "service_credentials_rejected"},
            )
        if status == 403:
            raise AuthError("acting user is not allowed to use this resource", details=details)
        raise CrossServiceError(
            "internal api rejected the request",
            details={**details, "body": response.text[:ERROR_BODY_LIMIT]},
        )


__all__ = ["InternalApiClient"]
