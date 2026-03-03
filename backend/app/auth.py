from __future__ import annotations

from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import Generator, Literal, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.database.db import SessionLocal
from app.database.models import Student, Teacher


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# In production move this to env var.
JWT_SECRET_KEY = "change_me_in_production"
JWT_ALGORITHM = "HS256"
JWT_EXPIRES_MINUTES = 60 * 24

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


@dataclass(frozen=True)
class AuthPrincipal:
    role: Literal["teacher", "student"]
    id: int


def create_access_token(*, role: Literal["teacher", "student"], subject_id: int) -> str:
    expire = datetime.utcnow() + timedelta(minutes=JWT_EXPIRES_MINUTES)
    payload = {"sub": str(subject_id), "role": role, "exp": expire}
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_teacher(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Teacher:
    principal = get_current_principal(token=token, db=db)
    if principal.role != "teacher":
        raise _unauthorized("Teacher access required")
    teacher = db.get(Teacher, principal.id)
    if teacher is None:
        raise _unauthorized("Teacher not found")
    return teacher


def get_current_student(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Student:
    principal = get_current_principal(token=token, db=db)
    if principal.role != "student":
        raise _unauthorized("Student access required")
    student = db.get(Student, principal.id)
    if student is None:
        raise _unauthorized("Student not found")
    return student


def get_current_principal(
    token: str,
    db: Session,
) -> AuthPrincipal:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        sub: Optional[str] = payload.get("sub")
        role: Optional[str] = payload.get("role")
        if not sub or role not in {"teacher", "student"}:
            raise _unauthorized("Invalid token")
        subject_id = int(sub)
    except (JWTError, ValueError):
        raise _unauthorized("Invalid token")

    if role == "teacher":
        if db.get(Teacher, subject_id) is None:
            raise _unauthorized("Teacher not found")
    else:
        if db.get(Student, subject_id) is None:
            raise _unauthorized("Student not found")

    return AuthPrincipal(role=role, id=subject_id)


def require_principal(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> AuthPrincipal:
    return get_current_principal(token=token, db=db)
