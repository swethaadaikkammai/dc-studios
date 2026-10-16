from typing import Optional
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    username_or_email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserRead"


class AuthMeResponse(BaseModel):
    user: "UserRead"


from app.schemas.user import UserRead
TokenResponse.model_rebuild()
AuthMeResponse.model_rebuild()
