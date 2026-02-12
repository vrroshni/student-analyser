from __future__ import annotations

from typing import List

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.schemas import StudentInput

from .models import PredictionRecord


def create_prediction_record(
    db: Session,
    *,
    student: StudentInput,
    prediction: str,
    confidence: float,
    model_used: str,
) -> PredictionRecord:
    record = PredictionRecord(
        age=student.age,
        internal_marks=student.internal_marks,
        previous_marks=student.previous_marks,
        attendance=student.attendance,
        prediction=prediction,
        confidence=confidence,
        model_used=model_used,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def list_prediction_records(db: Session, *, limit: int = 50) -> List[PredictionRecord]:
    stmt = select(PredictionRecord).order_by(desc(PredictionRecord.created_at)).limit(limit)
    return list(db.scalars(stmt).all())
