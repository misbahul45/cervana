from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime
from typing import TypedDict, Optional

class ResourceBody(TypedDict):
    resourceId: str
    content: Optional[str]
    status: Optional[str] 
    type_worker :str


class ResourceBase(BaseModel):
    id: str
    type: str
    title: Optional[str] = None
    content: Optional[str] = None
    urls: Optional[Any] = None
    file: Optional[Any] = None
    
    topicId: Optional[str] = None
    subTopicId: Optional[str] = None
    lessonId: Optional[str] = None
    stepId: Optional[str] = None
    
    isEmbedded: bool
    embeddingAt: Optional[datetime] = None
    
    jobStatus: str
    jobId: Optional[str] = None
    
    createdAt: datetime
    updatedAt: datetime

    class Config:
        from_attributes = True
        json_encoders = {
            datetime: lambda v: v.isoformat(),
        }
