import logging
from typing import Dict, Any
from celery import Celery
from config.embedding_pipeline import get_embedding_pipeline
from v1.resources.service import get_resource, extract_pdf, get_yt_transcript, callback_resource

from config.celery import celery_app

pipeline = None

def get_pipeline():
    global pipeline
    if pipeline is None:
        pipeline = get_embedding_pipeline()
    return pipeline



def extract_content(type: str, resource):
    url = resource.file.get("url")
    if not url:
        raise ValueError(f"{type} URL missing in resource")

    if type == "PDF":
        return extract_pdf(url)

    if type == "VIDEO":
        return get_yt_transcript(url)

    if type == "IMAGE":
        return ""

    raise ValueError("Invalid type")


@celery_app.task(
    name="v1.resources.workers.extract_task",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3
)
def extract_task(self, type: str, resource_id: str, token: str):
    logging.info(f"[CELERY][EXTRACT] Start for {resource_id}")

    if type not in ["PDF", "IMAGE", "VIDEO"]:
        raise ValueError("Invalid type")

    resource = get_resource(resource_id, token)
    if not resource:
        raise ValueError("Resource not found")

    try:
        text = extract_content(type, resource)
        metadata_payload = dict(resource) 

        for k in ["content", "embeddingAt", "jobStatus", "jobId", "isEmbedded"]:
            metadata_payload.pop(k, None)

        get_pipeline().upsert_document(
            content=text,
            source_id=resource.id,
            metadata=metadata_payload
        )

        callback_resource(
            resource_id,
            token,
            {"resourceId": resource_id, "content": text[:200], "type_worker": "EXTRACT", "status":"SUCCESS"}
        )

        logging.info(f"[CELERY][EXTRACT] Done for {resource_id}")

        return {"text": text}

    except Exception as e:
        logging.error(f"[CELERY][EMBEDDING][ERROR] {resource_id}: {e}")

        callback_resource(resource_id, token, {"status": "FAILED", "resourceId": resource_id})

        raise self.retry(exc=e, countdown=10)


@celery_app.task(
    name="v1.resources.workers.embedding_task",
    bind=True,
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3
)
def embedding_task(self, resource_data: Dict[str, Any], token: str):
    resource_id = resource_data.get("id")
    if not resource_id:
        logging.error("[CELERY][EMBEDDING][ERROR] resource_id missing")
        return

    content = resource_data.get("content")
    if not content:
        logging.warning(f"[CELERY][EMBEDDING] Empty content for {resource_id}")
        return

    logging.info(f"[CELERY][EMBEDDING] Start for {resource_id}")

    try:
        metadata_payload = dict(resource_data) 

        for k in ["content", "embeddingAt", "jobStatus", "jobId", "isEmbedded"]:
            metadata_payload.pop(k, None)

        get_pipeline().upsert_document(
            content=content,
            source_id=resource_id,
            metadata=metadata_payload
        )

        callback_resource(
            resource_id,
            token,
            {"resourceId": resource_id, "status": "SUCCESS", "type_worker": "EMMBED"}
        )

        logging.info(f"[CELERY][EMBEDDING] Done for {resource_id}")

        return {"status": "success", "resource_id": resource_id}

    except Exception as e:
        logging.error(f"[CELERY][EMBEDDING][ERROR] {resource_id}: {e}")

        callback_resource(resource_id, token, {"status": "FAILED", "resourceId": resource_id})

        raise self.retry(exc=e, countdown=10)
