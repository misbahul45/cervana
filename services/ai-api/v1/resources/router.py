from fastapi import APIRouter, HTTPException, Header, Query, Request
from typing import Dict
import logging
from v1.resources.service import get_resource
from v1.resources.workers import extract_task, embedding_task
from config.rate_limit import rate_limit
from config.user_auth import authenticate

RESOURCE_ROLES = {"TEACHER", "ADMIN"}

router = APIRouter(prefix="/resources", tags=["Resources"])

@router.post("/extract")
@rate_limit(capacity_per_minute=30, burst=5)
async def extract_resource(
    request: Request,
    type: str = Query(..., pattern="^(PDF|IMAGE|VIDEO)$"),
    resource_id: str = Query(...),
    Authorization: str | None = Header(None),
) -> Dict[str, str]:
    user = authenticate(Authorization, RESOURCE_ROLES)
    logging.info(f"[EXTRACT] Queuing task: {type}, {resource_id}")

    task = extract_task.delay(type, resource_id, user["id"])

    return {"task_id": task.id, "status": "queued"}


@router.post("/embedding/{resource_id}")
@rate_limit(capacity_per_minute=30, burst=5)
async def embed_single(
    request: Request,
    resource_id: str,
    Authorization: str | None = Header(None)
) -> Dict[str, str]:
    user = authenticate(Authorization, RESOURCE_ROLES)
    logging.info(f"[EMBEDDING] Queuing task for {resource_id}")

    resource = get_resource(resource_id)
    resource_dict = resource.dict()

    if not resource_dict.get("content"):
        raise HTTPException(400, "Resource content is missing or invalid")

    task = embedding_task.delay(resource_dict, user["id"])
    return {"task_id": task.id, "status": "queued"}