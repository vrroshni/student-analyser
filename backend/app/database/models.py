from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class Teacher(Base):
    __tablename__ = "teachers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True, default="")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True, default="")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class PredictionRecord(Base):
    __tablename__ = "prediction_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    student_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("students.id"),
        nullable=True,
        index=True,
    )

    name: Mapped[Optional[str]] = mapped_column(String, nullable=True, default="")

    department: Mapped[Optional[str]] = mapped_column(String, nullable=True, default="")

    semesters_json: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    avg_percentage: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    last_percentage: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    avg_attendance: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    prediction: Mapped[str] = mapped_column(String, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    model_used: Mapped[str] = mapped_column(String, nullable=False)

    photo: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    photo_content_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    photo_filename: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)


class CsvStudent(Base):
    __tablename__ = "csv_students"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    teacher_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("teachers.id"),
        nullable=False,
        index=True,
    )
    upload_batch: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    department: Mapped[str] = mapped_column(String, nullable=False)
    semesters_json: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
