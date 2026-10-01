from fastapi import APIRouter, HTTPException, Header, Body
from typing import Annotated
import logging
from v1.users_steps.dto import LPState

from sse_starlette.sse import EventSourceResponse

from v1.users_steps.workers import generate_personality_quiz
from v1.users_steps.service import get_steps, build_learning_introduction_llm
from config.embedding_pipeline import get_embedding_pipeline
from v1.users_steps.service import get_learning_style

from v1.users_steps.generate_user_steps_pipeline import generate_user_steps_pipeline

router = APIRouter(prefix='/users-steps', tags=['User-Steps'])
pipeline = get_embedding_pipeline()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@router.get('/generate-question')
async def generate_question_sse(
    lessonId: str,
    topicId: str,
    learningStyleId: str,
    userId: str,
    token: str
):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = {
        "userId": userId,
        "lessonId": lessonId,
        "topicId": topicId,
        "learningStyleId": learningStyleId,
        "token": token
    }
    generate_personality_quiz.delay(payload)
    
    try:
        steps = get_steps(lessonId, token)
        learningStyle=get_learning_style(learningStyleId=learningStyleId, token=token)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    async def event_stream():
        try:
            yield {"event": "status", "data": "Generating introduction..."}

            intro_chunks = []

            async for chunk in build_learning_introduction_llm(
                steps,
                pipeline,
                learning_style=learningStyle
            ):
                # Normalisasi chunk menjadi string
                if hasattr(chunk, "delta") and chunk.delta:
                    text = chunk.delta
                elif hasattr(chunk, "text") and chunk.text:
                    text = chunk.text
                elif hasattr(chunk, "content") and chunk.content:
                    text = chunk.content
                else:
                    text = chunk

                if callable(text):
                    text = text()

                if text is None:
                    continue

                if not isinstance(text, str):
                    text = str(text)

                text = text.strip()
                if not text:
                    continue

                intro_chunks.append(text)
                yield {"event": "introduction_chunk", "data": text}

            introduction = "".join(intro_chunks)
            yield {"event": "end", "data": introduction}

        except Exception as e:
            yield {"event": "error", "data": str(e)}

    return EventSourceResponse(event_stream())

@router.post("/generate")
async def generate_user_steps(
    payload: LPState = Body(...),
    authorization: Annotated[str | None, Header()] = None
):
    try:
        output = generate_user_steps_pipeline.invoke(payload)
        state = LPState(**output)

        if state.error:
            logger.error(f"❌ Generation failed: {state.error}")
            return {"error": state.error}

        return state.generated.data  

    except Exception as e:
        logger.error(f"❌ Pipeline execution error: {e}")
        return {"error": "Internal pipeline error"}

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid or missing Bearer token")

    token = authorization.split(" ")[1]
    payload.token = token 

    logger.info(f"🚀 Starting learning path generation for step: {payload.targetStepId}")

    try:
        state = generate_user_steps_pipeline.invoke(payload.model_dump())
        if state.error:
            raise ValueError(state.error)

        if not state.generated or not state.generated.data:
            raise ValueError("No steps generated")

        return [step.model_dump() for step in state.generate.data]

    except Exception as e:
        logger.error(f"❌ Generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))