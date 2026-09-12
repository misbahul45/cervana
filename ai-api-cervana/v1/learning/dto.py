from pydantic import BaseModel
from typing import List, Optional, Any, Dict, Union
from datetime import datetime

from v1.users_steps.dto import (
    TopicBase,
    StepBase,
    LearningStyleProfileBase,
)

class GenerateContentMaterialResponseDto(BaseModel):
    chatId: str
    chatMessageId: str
    data: Any
    citations: Optional[List[str] | Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        schema_extra = {
            "example": {
                "chatId": "a1234567-89ab-4cde-f012-3456789abcde",
                "chatMessageId": "b2345678-90cd-4ef1-2345-6789abcdef01",
                "data": (
                    "## Pengantar Akuntansi\n"
                    "Akuntansi adalah proses pencatatan dan pelaporan transaksi.\n\n"
                    "### Tujuan Akuntansi\n"
                    "- Menyediakan informasi keuangan\n"
                    "- Menjadi dasar pengambilan keputusan\n"
                ),
                "citations": ["Buku Akuntansi SMK Kelas XI Hal. 23"],
                "metadata": {
                    "difficulty": "beginner",
                    "source": "AI-generated"
                }
            }
        }


class UserStepBase(BaseModel):
    id: str
    userId: str
    isUnlocked: bool
    order: int
    stepTemplateId: Optional[str] = None
    title: str
    isDone: bool
    quizId: Optional[str] = None
    createdAt: datetime
    updatedAt: datetime

    class Config:
        orm_mode = True
        schema_extra = {
            "example": {
                "id": "b782f4ac-7cb9-458d-8f1f-81ac47711111",
                "userId": "6e768df9-2cfd-4fc0-a3f9-fb028e2a7da4",
                "isUnlocked": False,
                "order": 1,
                "stepTemplateId": "a5b0e623-4d98-46d2-b733-b12345678900",
                "title": "Pengenalan Dasar Akuntansi",
                "isDone": False,
                "quizId": None,
                "createdAt": "2025-11-29T12:00:00.000Z",
                "updatedAt": "2025-11-29T12:00:00.000Z",
            }
        }
class LessonBase(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    sortOrder: int = 0
    subTopicId: str
    themeId: str
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

    class Config:
        orm_mode = True

class GenerateContentMaterialPipeline(BaseModel):
    # Input IDs
    userId: str
    stepId: str
    userStepId: str
    topicId: str
    lessonId: str
    learningStyleId: str
    token: str
    messageId:str
    chatId:str

    # Fetched relations
    topic: Optional[TopicBase] = None
    learningStyle: Optional[LearningStyleProfileBase] = None
    step: Optional[StepBase] = None
    lesson: Optional[Any] = None
    userStep: Optional[UserStepBase] = None
    generate: Optional[Union[GenerateContentMaterialResponseDto, dict]] = None


    # Pipeline context & memory
    context: Optional[str] = None
    memory: Optional[str] = None
    analysis: Optional[str] = None




