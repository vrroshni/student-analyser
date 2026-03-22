from __future__ import annotations

import json
from typing import List
from typing import Optional

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.schemas import StudentInput

from .models import CsvStudent, PredictionRecord


def create_prediction_record(
    db: Session,
    *,
    student: StudentInput,
    prediction: str,
    confidence: float,
    model_used: str,
    student_id: Optional[int] = None,
) -> PredictionRecord:
    semesters = student.semesters
    percentages = [((s.internal_marks + s.university_marks) / 600.0) * 100.0 for s in semesters]
    avg_pct = float(sum(percentages) / max(1, len(percentages)))
    last_pct = float(percentages[-1]) if percentages else 0.0
    avg_att = float(sum(s.attendance for s in semesters) / max(1, len(semesters)))

    record = PredictionRecord(
        student_id=student_id,
        name=student.name,
        department=student.department,
        semesters_json=json.dumps([s.model_dump() for s in semesters]),
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


def list_prediction_records_for_student(
    db: Session,
    *,
    student_id: int,
    limit: int = 50,
) -> List[PredictionRecord]:
    stmt = (
        select(PredictionRecord)
        .where(PredictionRecord.student_id == student_id)
        .order_by(desc(PredictionRecord.created_at))
        .limit(limit)
    )
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


def create_csv_students_batch(
    db: Session,
    *,
    teacher_id: int,
    upload_batch: str,
    rows: List[dict],
) -> List[CsvStudent]:
    records = []
    for row in rows:
        record = CsvStudent(
            teacher_id=teacher_id,
            upload_batch=upload_batch,
            name=row["name"],
            department=row["department"],
            semesters_json=row["semesters_json"],
        )
        db.add(record)
        records.append(record)
    db.commit()
    for r in records:
        db.refresh(r)
    return records


def list_csv_students_for_teacher(
    db: Session,
    *,
    teacher_id: int,
) -> List[CsvStudent]:
    stmt = (
        select(CsvStudent)
        .where(CsvStudent.teacher_id == teacher_id)
        .order_by(desc(CsvStudent.created_at))
    )
    return list(db.scalars(stmt).all())
