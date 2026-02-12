from __future__ import annotations

from pydantic import BaseModel, Field


class TeacherSignup(BaseModel):
    email: str = Field(..., min_length=5, max_length=254)
    password: str = Field(..., min_length=6, max_length=128)
    name: str = Field(default="", max_length=120)


class TeacherLogin(BaseModel):
    email: str = Field(..., min_length=5, max_length=254)
    password: str = Field(..., min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
