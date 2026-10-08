import hashlib
import os
from typing import Any
import httpx


async def run_creator_assistant(
    user_id: str, query: str, token: str, fetcher=None
) -> dict[str, Any]:
    api_base = os.environ.get("NEST_API") or "http://api:3002/api/v1"
    headers = {"Authorization": token}
    if fetcher is None:
        client = httpx.AsyncClient
    else:
        client = fetcher

    async with client() as f:
        articles_resp = await f.get(f"{api_base}/articles", headers=headers)
        classes_resp = await f.get(f"{api_base}/classes", headers=headers)
        earnings_resp = await f.get(f"{api_base}/commerce/studio-earnings/me", headers=headers)

    articles = articles_resp.json() if hasattr(articles_resp, "json") else articles_resp
    classes = classes_resp.json() if hasattr(classes_resp, "json") else classes_resp
    earnings = earnings_resp.json() if hasattr(earnings_resp, "json") else earnings_resp

    prompt_hash = hashlib.sha256(query.encode()).hexdigest()[:16]
    return {
        "agent": "creator_assistant_agent",
        "intent": "creator_assistant",
        "promptHash": prompt_hash,
        "toolCalls": [
            {"name": "list_my_articles", "endpoint": "/articles", "result": len(articles)},
            {"name": "list_my_classes", "endpoint": "/classes", "result": len(classes)},
            {"name": "list_earnings", "endpoint": "/commerce/studio-earnings/me", "result": earnings},
        ],
        "deterministicOutputs": {
            "articleCount": len(articles),
            "classCount": len(classes),
            "availableBalance": earnings.get("available") if isinstance(earnings, dict) else None,
        },
    }