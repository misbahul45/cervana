from fastapi import APIRouter, HTTPException, Header, Query
from typing import Dict
import logging
from v1.resources.service import get_resource
from v1.resources.workers import extract_task, embedding_task

router = APIRouter(prefix="/resources", tags=["Resources"])

@router.post("/extract")
async def extract_resource(
    type: str = Query(..., regex="^(PDF|IMAGE|VIDEO)$"),
    resource_id: str = Query(...),
    Authorization: str | None = Header(None),
) -> Dict[str, str]:
    if not Authorization:
        raise HTTPException(401, "Unauthorized user")

    token = Authorization.replace("Bearer", "").strip()

    print(token)
    logging.info(f"[EXTRACT] Queuing task: {type}, {resource_id}")

    task = extract_task.delay(type, resource_id, token)

    return {"task_id": task.id, "status": "queued"}


@router.post("/embedding/{resource_id}")
async def embed_single(
    resource_id: str,
    Authorization: str | None = Header(None)
) -> Dict[str, str]:
    if not Authorization:
        raise HTTPException(401, "Unauthorized user")

    token = Authorization.replace("Bearer", "").strip()
    logging.info(f"[EMBEDDING] Queuing task for {resource_id}")

    resource = get_resource(resource_id, token)
    resource_dict = resource.dict()

    if not resource_dict.get("content"):
        raise HTTPException(400, "Resource content is missing or invalid")


    task = embedding_task.delay(resource_dict, token)
    return {"task_id": task.id, "status": "queued"}