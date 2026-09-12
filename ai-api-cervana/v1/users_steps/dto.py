from pydantic import BaseModel, Field, UUID4
from typing import Optional, Any, List, Literal, Union, Dict, Annotated
from datetime import datetime
from operator import add 

class GenerateQuestionRequest(BaseModel):
    lessonId:str
    topicId: str
    subTopicId: str
    learningStyleId: str
    userId:str
    

class TopicBase(BaseModel):
    id: str
    title: str
    slug: str
    description: Optional[str] = None
    image: Any
    isVerified: bool
    price: float
    topicDuration: int

    quizzes: Optional[List[Any]] = None
    subTopics: Optional[List[Any]] = None
    userTopics: Optional[list[Any]] = None
    orders: Optional[List[Any]] = None
    resources: Optional[List[Any]] = None
    leaderboardScores: Optional[List[Any]] = None
    categories: Optional[List[Any]] = None

    createdBy: Optional[str] = None
    teacher: Optional[Any] = None

    createdAt: datetime
    updatedAt: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
        }


class StepBase(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    sortOrder: int

    lessonId: str
    lesson: Optional[Any] = None

    themeId: str
    theme: Optional[Any] = None

    quizzes: Optional[List[Any]] = None
    chat: Optional[Any] = None
    userSteps: Optional[List[Any]] = None
    resources: Optional[List[Any]] = None

    createdAt: datetime
    updatedAt: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
        }

    
class LearningStyleProfileBase(BaseModel):
    id: str

    userTopicId: str
    userTopic: Optional[Any] = None

    visual: Optional[float] = None
    auditory: Optional[float] = None
    reading: Optional[float] = None
    kinesthetic: Optional[float] = None

    dominantStyle: Optional[str] = None
    takenAt: Optional[datetime] = None

    createdAt: datetime
    updatedAt: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
        }

class GenerateQuestionPipeline(BaseModel):
    topicId: str
    lessonId: str
    learningStyleId: str
    token: str
    topic: Optional[TopicBase] = None
    steps: Optional[List[StepBase]] = None
    learningStyle: Optional[LearningStyleProfileBase] = None
    context: Optional[str] = None
    quiz: Optional[List[Any]] = None


class PersonalityQuiz(BaseModel):
    question:str
    answer:str
    userAnswer:str



class GenerateUserStepPipeline(BaseModel):
    userId:str
    stepId:str
    topicId: str
    lessonId: str
    learningStyleId: str
    token: str
    topic: Optional[TopicBase] = None
    steps: Optional[List[StepBase]] = None
    learningStyle: Optional[LearningStyleProfileBase] = None
    context: Optional[str] = None


class QuizItem(BaseModel):
    question: str
    type: Literal["multiple_choice", "input", "matching", "scenario"]
    difficulty: Literal["easy", "medium", "hard", "hots"]
    options: Optional[List[str]] = None
    answer: Optional[str] = None


class QuizResponse(BaseModel):
    quiz: List[QuizItem]



class BaseUserStep(BaseModel):
    userId: str = Field(..., description="Related User ID")
    stepTemplateId: Optional[str] = Field(None, description="Optional template step ID")
    title: str = Field(..., min_length=1, description="Step title")
    isDone: bool = Field(default=False, description="Completion status")
    order: int = Field(...)

class GenerateUserStepRespon(BaseModel):
    data:List[BaseUserStep]


class PersonalityQuizQuestion(BaseModel):
    question: str
    type: str
    difficulty: str
    options: Optional[List[str]] = None
    answer: Optional[str] = None


class PersonalityQuizUserAttemptItem(BaseModel):
    question: str
    userAnswer: str
    answer: Optional[str] = None


class PersonalityQuizValue(BaseModel):
    scores: Optional[Dict[str, int]] = None
    level: Optional[str] = None


class PersonalityQuizBase(BaseModel):
    userId: UUID4
    lessonId: UUID4
    title: str
    questions: List[PersonalityQuizQuestion]
    userAttempt: Optional[Union[List[PersonalityQuizUserAttemptItem], str]] = None
    result: Optional[Union[PersonalityQuizValue, str]] = None
    takenAt: Optional[str] = None

class PersonalityQuizResult(BaseModel):
    userId: str
    strengths: List[str]
    weaknesses: List[str]
    learningPreferences: List[str]
    motivationFactors: List[str]
    challenges: List[str]

class LPState(BaseModel):
    class Config:
        arbitrary_types_allowed = True
    
    userId: str
    token: str
    topicId: str
    lessonId: str
    learningStyleId: str
    targetStepId:str
    
    topic: Optional[TopicBase] = None
    learningStyle: Optional[LearningStyleProfileBase] = None
    targetStep: Optional[StepBase] = None
    allLessonSteps: List[StepBase] = Field(default_factory=list)
    personalityQuizResult: Optional[PersonalityQuizResult] = None
    personalityQuizRaw: Optional[PersonalityQuizBase] = None
    
    context: str = ""
    memory: str = ""
    semanticResults: str = ""
    externalResults: str = ""
    generated: Optional[GenerateUserStepRespon] = None
    error: Optional[str] = None
