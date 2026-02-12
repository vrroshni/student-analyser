from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.database.db import SessionLocal
from app.database.models import Teacher


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# In production move this to env var.
JWT_SECRET_KEY = "change_me_in_production"
JWT_ALGORITHM = "HS256"
JWT_EXPIRES_MINUTES = 60 * 24

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_db() -> Session:
    db = SessionLocal()
    try:
        return db
    finally:
        pass


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(*, teacher_id: int) -> str:
    expire = datetime.utcnow() + timedelta(minutes=JWT_EXPIRES_MINUTES)
    payload = {"sub": str(teacher_id), "exp": expire}
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_teacher(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(SessionLocal),
) -> Teacher:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        sub: Optional[str] = payload.get("sub")
        if not sub:
            raise _unauthorized("Invalid token")
        teacher_id = int(sub)
    except (JWTError, ValueError):
        raise _unauthorized("Invalid token")

    teacher = db.get(Teacher, teacher_id)
    if teacher is None:
        raise _unauthorized("Teacher not found")
    return teacher
