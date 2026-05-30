# pyrefly: ignore [missing-import]
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import List, Optional
from datetime import datetime

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    role: str
    requires_password_change: bool = False
    created_at: datetime

class PasswordResetRequest(BaseModel):
    new_password: str
    confirm_password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class QuestionFeedbackCreate(BaseModel):
    feedback_type: str
    comments: Optional[str] = None

class UserGeneratedExamCreate(BaseModel):
    title: str
    topics: str
    difficulty: str
    questions_json: list
