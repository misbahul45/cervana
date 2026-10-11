from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import Dict
import logging
from v1.resources.service import get_resource
from v1.resources.workers import extract_task, embedding_task
from config.rate_limit import rate_limit
from config.service_identity import service_actor
from middleware.idempotency import require_idempotency_key

router = APIRouter(prefix="/resources", tags=["Resources"])

@router.post("/extract")
@rate_limit(capacity_per_minute=30, burst=5)
@require_idempotency_key(mint_if_missing=False)
async def extract_resource(
    request: Request,
    type: str = Query(..., pattern="^(PDF|IMAGE|VIDEO)$"),
    resource_id: str = Query(...),
    user: dict = Depends(service_actor),
) -> Dict[str, str]:
    logging.info(f"[EXTRACT] Queuing task: {type}, {resource_id}")

    task = extract_task.delay(type, resource_id, user["id"])

    return {"task_id": task.id, "status": "queued"}


@router.post("/embedding/{resource_id}")
@rate_limit(capacity_per_minute=30, burst=5)
@require_idempotency_key(mint_if_missing=False)
async def embed_single(
    request: Request,
    resource_id: str,
    user: dict = Depends(service_actor),
) -> Dict[str, str]:
    logging.info(f"[EMBEDDING] Queuing task for {resource_id}")

    resource = get_resource(resource_id)
    resource_dict = resource.dict()

    if not resource_dict.get("content"):
        raise HTTPException(400, "Resource content is missing or invalid")

    task = embedding_task.delay(resource_dict, user["id"])
    return {"task_id": task.id, "status": "queued"}