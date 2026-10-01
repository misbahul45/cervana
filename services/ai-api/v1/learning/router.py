from fastapi import APIRouter, HTTPException, Header, Body
from pydantic import ValidationError
import logging
from v1.learning.dto import GenerateContentMaterialPipeline
from v1.learning.workers import generate_content_material_task, generating_new_content 

router = APIRouter(prefix="/learning", tags=["Learning"])

logger = logging.getLogger(__name__)


@router.post("/generate-material")
async def generate_learning_content(
    authorization: str = Header(..., description="Bearer token for authentication"),
    body: dict = Body(..., description="Request body for generating learning content")
):
    try:
        # Extract token
        token = authorization.replace("Bearer ", "")
        state = GenerateContentMaterialPipeline(**body, token=token)

        task = generate_content_material_task.delay(state.dict())

        return {
            "status": "processing",
            "task_id": task.id,
            "message": "Content generation started"
        }

    except ValidationError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=422, detail=str(e))

    except Exception as e:
        logger.error(f"Error generating learning content: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")



@router.post("/chat")
async def chat(
    authorization: str = Header(..., description="Bearer token for authentication"),
    body: dict = Body(..., description="Request body for generating learning content")
):
    try:
        token = authorization.replace("Bearer ", "")
        task=generating_new_content.delay({**body, "token": token})
        return {
            "status": "processing",
            "task_id": task.id,
            "message": "Content generation started"
        }

    except ValidationError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=422, detail=str(e))

    except Exception as e:
        logger.error(f"Error generating learning content: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")