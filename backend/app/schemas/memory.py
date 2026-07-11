from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import uuid

class ConversationBase(BaseModel):
    title: str

class ConversationCreate(ConversationBase):
    pass

class ConversationResponse(ConversationBase):
    id: int
    createdAt: datetime

class MessageBase(BaseModel):
    role: str
    content: str

class MessageCreate(BaseModel):
    content: str
    imageBase64: Optional[str] = None

class MessageResponse(MessageBase):
    id: int
    conversationId: int
    createdAt: datetime

class ConversationDetailResponse(ConversationResponse):
    messages: List[MessageResponse]
