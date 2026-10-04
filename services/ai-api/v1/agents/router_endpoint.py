import os
import httpx
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel

from v1.agents.router import dispatch
from v1.agents.creator_assistant_agent import run_creator_assistant
from v1.agents.career_agent import run_career
from v1.agents.curriculum_agent import run_curriculum

router = APIRouter(prefix="/v1/agents", tags=["Agents"])


class AgentRequest(BaseModel):
    userId: str
    intent: str
    query: str
    lessonId: str | None = None


@router.post("/run")
async def run_agent(req: AgentRequest, request: Request):
    token = request.headers.get("Authorization") or ""
    if not token.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="bearer_token_required")

    agent_name = dispatch(req.intent)
    if agent_name == "tutor_agent":
        result = await run_curriculum(req.userId, req.lessonId or "", req.query, token)
        result["agent"] = agent_name
    elif agent_name == "creator_assistant_agent":
        result = await run_creator_assistant(req.userId, req.query, token)
    elif agent_name == "career_agent":
        result = await run_career(req.userId, req.query, token)
    elif agent_name == "curriculum_agent":
        result = await run_curriculum(req.userId, req.lessonId or "", req.query, token)
        result["agent"] = agent_name
    elif agent_name == "assessment_agent":
        result = await run_curriculum(req.userId, req.lessonId or "", req.query, token)
        result["agent"] = agent_name
    else:
        raise HTTPException(status_code=400, detail=f"unhandled_agent:{agent_name}")

    api_base = os.environ.get("NEST_API") or "http://api:3002"
    async with httpx.AsyncClient(timeout=5.0) as f:
        await f.post(
            f"{api_base}/v1/agents/decision-trace/record",
            json={
                "agentName": result["agent"],
                "agentScope": req.intent.upper(),
                "userId": req.userId,
                "promptHash": result.get("promptHash", ""),
                "responseHash": "",
                "toolCalls": result.get("toolCalls", []),
                "deterministicOutputs": result.get("deterministicOutputs", {}),
            },
            headers={"Authorization": token},
        )
    return result