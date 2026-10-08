from __future__ import annotations

from datetime import datetime
from operator import add
from typing import Any, Dict, List, Literal, Optional, Union
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


def _to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


_BASE_CONFIG = ConfigDict(
    alias_generator=_to_camel,
    populate_by_name=True,
    from_attributes=True,
)


class GenerateQuestionRequest(BaseModel):
    model_config = _BASE_CONFIG

    lesson_id: str
    topic_id: str
    sub_topic_id: str
    learning_style_id: str
    user_id: str


class TopicBase(BaseModel):
    model_config = _BASE_CONFIG

    id: str
    title: str
    slug: str
    description: Optional[str] = None
    image: Any
    is_verified: bool
    price: float
    topic_duration: int

    quizzes: Optional[List[Any]] = None
    sub_topics: Optional[List[Any]] = None
    user_topics: Optional[List[Any]] = None
    orders: Optional[List[Any]] = None
    resources: Optional[List[Any]] = None
    leaderboard_scores: Optional[List[Any]] = None
    categories: Optional[List[Any]] = None

    created_by: Optional[str] = None
    teacher: Optional[Any] = None

    created_at: datetime
    updated_at: datetime


class StepBase(BaseModel):
    model_config = _BASE_CONFIG

    id: str
    title: str
    description: Optional[str] = None
    sort_order: int

    lesson_id: str
    lesson: Optional[Any] = None

    theme_id: str
    theme: Optional[Any] = None

    quizzes: Optional[List[Any]] = None
    chat: Optional[Any] = None
    user_steps: Optional[List[Any]] = None
    resources: Optional[List[Any]] = None

    created_at: datetime
    updated_at: datetime


class LearningStyleProfileBase(BaseModel):
    model_config = _BASE_CONFIG

    id: str

    user_topic_id: str
    user_topic: Optional[Any] = None

    visual: Optional[float] = None
    auditory: Optional[float] = None
    reading: Optional[float] = None
    kinesthetic: Optional[float] = None

    dominant_style: Optional[str] = None
    taken_at: Optional[datetime] = None

    created_at: datetime
    updated_at: datetime


class GenerateQuestionPipeline(BaseModel):
    model_config = _BASE_CONFIG

    topic_id: str
    lesson_id: str
    learning_style_id: str
    session_id: str
    acting_user_id: str
    tenant_id: str
    trace_id: str
    idempotency_key: str
    topic: Optional[TopicBase] = None
    steps: Optional[List[StepBase]] = None
    learning_style: Optional[LearningStyleProfileBase] = None
    context: Optional[str] = None
    quiz: Optional[List[Any]] = None


class PersonalityQuiz(BaseModel):
    model_config = _BASE_CONFIG

    question: str
    answer: str
    user_answer: str


class GenerateUserStepPipeline(BaseModel):
    model_config = _BASE_CONFIG

    user_id: str
    step_id: str
    topic_id: str
    lesson_id: str
    learning_style_id: str
    session_id: str
    acting_user_id: str
    tenant_id: str
    trace_id: str
    idempotency_key: str
    topic: Optional[TopicBase] = None
    steps: Optional[List[StepBase]] = None
    learning_style: Optional[LearningStyleProfileBase] = None
    context: Optional[str] = None


class QuizItem(BaseModel):
    model_config = _BASE_CONFIG

    question: str
    type: Literal["multiple_choice", "input", "matching", "scenario"]
    difficulty: Literal["easy", "medium", "hard", "hots"]
    options: Optional[List[str]] = None
    answer: Optional[str] = None


class QuizResponse(BaseModel):
    model_config = _BASE_CONFIG

    quiz: List[QuizItem]


class BaseUserStep(BaseModel):
    model_config = _BASE_CONFIG

    user_id: str = Field(..., description="Related User ID")
    step_template_id: Optional[str] = Field(None, description="Optional template step ID")
    title: str = Field(..., min_length=1, description="Step title")
    is_done: bool = Field(default=False, description="Completion status")
    order: int = Field(...)


class GenerateUserStepRespon(BaseModel):
    model_config = _BASE_CONFIG

    data: List[BaseUserStep]


class PersonalityQuizQuestion(BaseModel):
    model_config = _BASE_CONFIG

    question: str
    type: str
    difficulty: str
    options: Optional[List[str]] = None
    answer: Optional[str] = None


class PersonalityQuizUserAttemptItem(BaseModel):
    model_config = _BASE_CONFIG

    question: str
    user_answer: str
    answer: Optional[str] = None


class PersonalityQuizValue(BaseModel):
    model_config = _BASE_CONFIG

    scores: Optional[Dict[str, int]] = None
    level: Optional[str] = None


class PersonalityQuizBase(BaseModel):
    model_config = _BASE_CONFIG

    user_id: UUID
    lesson_id: UUID
    title: str
    questions: List[PersonalityQuizQuestion]
    user_attempt: Optional[Union[List[PersonalityQuizUserAttemptItem], str]] = None
    result: Optional[Union[PersonalityQuizValue, str]] = None
    taken_at: Optional[str] = None


class PersonalityQuizResult(BaseModel):
    model_config = _BASE_CONFIG

    user_id: str
    strengths: List[str]
    weaknesses: List[str]
    learning_preferences: List[str]
    motivation_factors: List[str]
    challenges: List[str]


class LPState(BaseModel):
    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
        arbitrary_types_allowed=True,
    )

    user_id: str
    session_id: str
    acting_user_id: str
    tenant_id: str
    trace_id: str
    idempotency_key: str
    topic_id: str
    lesson_id: str
    learning_style_id: str
    target_step_id: str

    topic: Optional[TopicBase] = None
    learning_style: Optional[LearningStyleProfileBase] = None
    target_step: Optional[StepBase] = None
    all_lesson_steps: List[StepBase] = Field(default_factory=list)
    personality_quiz_result: Optional[PersonalityQuizResult] = None
    personality_quiz_raw: Optional[PersonalityQuizBase] = None

    context: str = ""
    memory: str = ""
    semantic_results: str = ""
    external_results: str = ""
    generated: Optional[GenerateUserStepRespon] = None
    error: Optional[str] = None


__all__ = [
    "GenerateQuestionRequest",
    "TopicBase",
    "StepBase",
    "LearningStyleProfileBase",
    "GenerateQuestionPipeline",
    "PersonalityQuiz",
    "GenerateUserStepPipeline",
    "QuizItem",
    "QuizResponse",
    "BaseUserStep",
    "GenerateUserStepRespon",
    "PersonalityQuizQuestion",
    "PersonalityQuizUserAttemptItem",
    "PersonalityQuizValue",
    "PersonalityQuizBase",
    "PersonalityQuizResult",
    "LPState",
]