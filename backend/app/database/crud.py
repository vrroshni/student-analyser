from __future__ import annotations

import json
from typing import List
from typing import Optional

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
    semesters = student.semesters
    percentages = [((s.internal_marks + s.university_marks) / 600.0) * 100.0 for s in semesters]
    avg_pct = float(sum(percentages) / max(1, len(percentages)))
    last_pct = float(percentages[-1]) if percentages else 0.0
    avg_att = float(sum(s.attendance for s in semesters) / max(1, len(semesters)))

    record = PredictionRecord(
        name=student.name,
        department=student.department,
        semesters_json=json.dumps([s.model_dump() for s in semesters]),
        age=student.age,
        avg_percentage=avg_pct,
        last_percentage=last_pct,
        avg_attendance=avg_att,
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


def set_prediction_photo(
    db: Session,
    *,
    record_id: int,
    photo: bytes,
    content_type: Optional[str],
    filename: Optional[str],
) -> Optional[PredictionRecord]:
    record = db.get(PredictionRecord, record_id)
    if record is None:
        return None
    record.photo = photo
    record.photo_content_type = content_type
    record.photo_filename = filename
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
