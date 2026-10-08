import logging
import os
import httpx
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel

from config.rate_limit import rate_limit
from config.trace_context import current_trace_id
from config.user_auth import authenticated_user, bind_acting_user
from v1.agents.router import dispatch
from v1.agents.creator_assistant_agent import run_creator_assistant
from v1.agents.career_agent import run_career
from v1.agents.curriculum_agent import run_curriculum

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/agents", tags=["Agents"])

CURRICULUM_BACKED_AGENTS = frozenset({"tutor_agent", "curriculum_agent", "assessment_agent"})


class AgentRequest(BaseModel):
    userId: str
    intent: str
    query: str
    lessonId: str | None = None


@router.post("/run")
@rate_limit(capacity_per_minute=120, burst=20)
async def run_agent(
    req: AgentRequest,
    request: Request,
    user: dict = Depends(authenticated_user),
):
    bind_acting_user(user, req.userId)
    idempotency_key = request.headers.get("Idempotency-Key") or ""
    if not idempotency_key or len(idempotency_key) < 8:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "IDEMPOTENCY_KEY_REQUIRED",
                "message": "Idempotency-Key header required (>= 8 chars)",
            },
        )
    idempotency_key = f"{req.userId}:{req.intent}:{idempotency_key}"
    token = f"Bearer {request.state.bearer_token}"

    try:
        agent_name = dispatch(req.intent)
    except ValueError:
        raise HTTPException(status_code=400, detail="unknown_intent") from None

    if agent_name in CURRICULUM_BACKED_AGENTS:
        async with httpx.AsyncClient(timeout=10.0) as fetcher:
            result = await run_curriculum(req.userId, req.lessonId or "", req.query, token, fetcher)
        result["agent"] = agent_name
    elif agent_name == "creator_assistant_agent":
        result = await run_creator_assistant(req.userId, req.query, token)
    elif agent_name == "career_agent":
        result = await run_career(req.userId, req.query, token)
    else:
        raise HTTPException(status_code=400, detail=f"unhandled_agent:{agent_name}")

    result["idempotencyKey"] = idempotency_key

    api_base = os.environ.get("NEST_API") or "http://api:3002/api/v1"
    recorded = False
    async with httpx.AsyncClient(timeout=5.0) as f:
        try:
            response = await f.post(
                f"{api_base}/agents/decision-trace/record",
                json={
                    "agentName": result["agent"],
                    "agentScope": req.intent.upper(),
                    "userId": req.userId,
                    "promptHash": result.get("promptHash", ""),
                    "responseHash": result.get("responseHash", ""),
                    "toolCalls": result.get("toolCalls", []),
                    "deterministicOutputs": result.get("deterministicOutputs", {}),
                },
                headers={
                    "Authorization": token,
                    "x-idempotency-key": idempotency_key,
                },
            )
            recorded = response.status_code < 300
            if not recorded:
                logger.error("decision-trace write rejected status=%s", response.status_code)
        except Exception:
            logger.exception("decision-trace write failed")

    result["decisionTraceRecorded"] = recorded
    return result
