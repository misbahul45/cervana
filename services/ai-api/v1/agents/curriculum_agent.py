"""CurriculumAgent: deterministic fetch + memory persistence over the api.

The agent delegates:
1. Next-activity policy decision to api /v1/personalization/policy/next
2. Lesson-scoped memory recall to api /v1/personalization/memory?lessonId=...
3. Short-term memory write to api /v1/personalization/memory

The LLM streaming explanation is wired in Phase 7 (LangGraph). For Phase 2
the deterministic scaffolding is in place.
"""

import os
from typing import Any, Optional


async def run_curriculum(
    user_id: str,
    lesson_id: str,
    query: str,
    token: str,
    fetcher,
    api_base: Optional[str] = None,
) -> dict[str, Any]:
    base = api_base or os.environ.get("NEST_API") or "http://api:3002"
    headers = {"Authorization": token}

    policy_resp = await fetcher.get(f"{base}/v1/personalization/policy/next", headers=headers)
    policy_resp.raise_for_status()
    decision = policy_resp.json()

    memory_resp = await fetcher.get(
        f"{base}/v1/personalization/memory",
        params={"lessonId": lesson_id},
        headers=headers,
    )
    memory_resp.raise_for_status()
    memory = memory_resp.json()

    body = {
        "lessonId": lesson_id,
        "kind": "SHORT_TERM",
        "payload": {"query": query, "decision": decision},
    }
    persist_resp = await fetcher.post(
        f"{base}/v1/personalization/memory", json=body, headers=headers
    )
    persist_resp.raise_for_status()
    stored = persist_resp.json()

    return {"decision": decision, "memory": memory, "stored": stored}