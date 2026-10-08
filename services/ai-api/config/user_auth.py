import logging

import requests
from fastapi import HTTPException, Request

from config.envs import ENVS

LEARNER_ROLES = frozenset({"STUDENT", "TEACHER", "REVIEWER", "ADMIN"})
ACCESS_COOKIE = "access_token"


def authenticate(authorization: str | None, allowed_roles: set[str]) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Unauthorized user")

    token = authorization[7:].strip()
    if not token:
        raise HTTPException(401, "Unauthorized user")

    try:
        res = requests.get(
            f"{ENVS['NEST_API']}/auth/profile",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
    except requests.RequestException as exc:
        logging.error(f"[AUTH] Profile lookup failed: {exc}")
        raise HTTPException(503, "Authentication service unavailable")

    if res.status_code in (401, 403):
        raise HTTPException(401, "Unauthorized user")
    if not res.ok:
        raise HTTPException(503, "Authentication service unavailable")

    user = res.json().get("data") or {}
    if not user.get("id") or user.get("role") not in allowed_roles:
        raise HTTPException(403, "Insufficient role")

    return user


def bearer_token(request: Request) -> str | None:
    header = request.headers.get("authorization") or ""
    if header.lower().startswith("bearer "):
        token = header[7:].strip()
        if token:
            return token
    return request.cookies.get(ACCESS_COOKIE) or None


def authenticated_user(request: Request) -> dict:
    token = bearer_token(request)
    user = authenticate(f"Bearer {token}" if token else None, set(LEARNER_ROLES))
    request.state.bearer_token = token
    return user


def bind_acting_user(user: dict, claimed: str | None) -> str:
    if claimed and claimed != user["id"]:
        raise HTTPException(403, "Acting user does not match the authenticated user")
    return user["id"]
