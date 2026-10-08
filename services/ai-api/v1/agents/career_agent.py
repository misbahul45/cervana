import hashlib
import os
from typing import Any
import httpx


async def run_career(
    user_id: str, query: str, token: str, fetcher=None
) -> dict[str, Any]:
    api_base = os.environ.get("NEST_API") or "http://api:3002/api/v1"
    headers = {"Authorization": token}
    if fetcher is None:
        client = httpx.AsyncClient
    else:
        client = fetcher

    async with client() as f:
        mastery_resp = await f.get(f"{api_base}/personalization/mastery/me", headers=headers)
        classes_resp = await f.get(f"{api_base}/marketplace/classes", headers=headers)

    mastery = mastery_resp.json() if hasattr(mastery_resp, "json") else mastery_resp
    classes = classes_resp.json() if hasattr(classes_resp, "json") else classes_resp

    strong_topics = sorted(
        [m.get("topicId") for m in (mastery or []) if m.get("score", 0) >= 0.85]
    )
    prompt_hash = hashlib.sha256(query.encode()).hexdigest()[:16]

    return {
        "agent": "career_agent",
        "intent": "career",
        "promptHash": prompt_hash,
        "toolCalls": [
            {"name": "list_mastery", "endpoint": "/personalization/mastery/me", "result": mastery},
            {"name": "list_marketplace_classes", "endpoint": "/marketplace/classes", "result": len(classes)},
        ],
        "deterministicOutputs": {"strongTopics": strong_topics},
    }