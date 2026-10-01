import logging

import requests
from fastapi import HTTPException

from config.envs import ENVS


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
