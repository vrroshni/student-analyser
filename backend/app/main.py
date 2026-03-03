from __future__ import annotations

import json
import warnings
from typing import Generator, List, Literal, Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.auth import AuthPrincipal, create_access_token, get_current_teacher, hash_password, require_principal, verify_password
from app.database.crud import create_prediction_record, list_prediction_records, list_prediction_records_for_student, set_prediction_photo
from app.database.db import SessionLocal, init_db
from app.database.models import Student, Teacher
from app.schemas import (
    FeatureContribution,
    PredictionOutput,
    StudentInput,
    StudentLogin,
    StudentSignup,
    TeacherLogin,
    TeacherSignup,
    TokenResponse,
)
from app.services.predictor import ModelArtifactsNotFound, PredictorService


app = FastAPI(
    title="Student Performance Analyzer",
    description="API for predicting student performance",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"] ,
    allow_headers=["*"],
)


predictor = PredictorService()


def _rule_score(student: StudentInput) -> float:
    # Compute the same rule-style score as the synthetic data generator uses,
    # but based only on the semesters actually provided.
    sems = student.semesters
    if not sems:
        return 0.0

    pcts = [((s.internal_marks + s.university_marks) / 600.0) * 100.0 for s in sems]
    avg_pct = sum(pcts) / len(pcts)
    # Use the highest-numbered semester as "last".
    last_sem = max(sems, key=lambda s: s.semester)
    last_pct = ((last_sem.internal_marks + last_sem.university_marks) / 600.0) * 100.0
    avg_att = sum(float(s.attendance) for s in sems) / len(sems)

    score = 0.0
    score += 0.55 * avg_pct
    score += 0.25 * last_pct
    score += 0.20 * avg_att
    score += (student.age - 20) * 0.5
    return float(score)


def _rule_label(score: float) -> str:
    if score >= 75:
        return "Good"
    if score >= 55:
        return "Average"
    return "Needs Attention"


def _assess_data_quality(student: StudentInput) -> tuple[bool, float]:
    """
    Assess the quality of student data and return (is_suspicious, quality_score).
    Quality score ranges from 0.0 (very bad) to 1.0 (good quality).
    """
    sems = student.semesters
    if not sems:
        return True, 0.0
    
    quality_score = 1.0
    is_suspicious = False
    
    # Check for very low marks
    percentages = [((s.internal_marks + s.university_marks) / 600.0) * 100.0 for s in sems]
    avg_pct = sum(percentages) / len(percentages)
    
    # Penalize very low averages (5-15% range is suspicious)
    if avg_pct < 15.0:
        quality_score *= 0.5
        is_suspicious = True
    elif avg_pct < 25.0:
        quality_score *= 0.7
    
    # Check for very low attendance
    avg_att = sum(s.attendance for s in sems) / len(sems)
    if avg_att < 10.0:
        quality_score *= 0.6
        is_suspicious = True
    elif avg_att < 30.0:
        quality_score *= 0.8
    
    # Check for unrealistic patterns: all semesters have identical marks
    if len(sems) > 1:
        first = sems[0]
        all_identical = all(
            s.internal_marks == first.internal_marks and 
            s.university_marks == first.university_marks and
            s.attendance == first.attendance
            for s in sems
        )
        if all_identical:
            quality_score *= 0.7
            is_suspicious = True
    
    # Check if only providing very few semesters with very low marks
    if len(sems) <= 2 and avg_pct < 20.0:
        quality_score *= 0.8
        is_suspicious = True
    
    return is_suspicious, max(0.0, min(1.0, quality_score))


def _apply_rule_override(*, student: StudentInput, prediction: str, confidence: float, model_used: str) -> tuple[str, float, str]:
    score = _rule_score(student)
    label = _rule_label(score)
    
    # Assess data quality
    is_suspicious, quality_score = _assess_data_quality(student)
    
    # If data quality is poor, adjust confidence and potentially downgrade prediction
    if is_suspicious:
        # Reduce confidence based on quality score
        confidence = confidence * quality_score
        
        # For very poor quality data (quality_score < 0.6), force to "Needs Attention"
        if quality_score < 0.6:
            return "Needs Attention", confidence, f"{model_used} + Quality Check"
        
        # For moderately poor quality (0.6 <= quality_score < 0.8), cap at "Average"
        if quality_score < 0.8:
            order = {"Needs Attention": 0, "Average": 1, "Good": 2}
            if order.get(prediction, 0) > 1:  # If predicted "Good"
                return "Average", confidence, f"{model_used} + Quality Check"

    # Only override upward when the rule says the student is clearly in a higher band.
    order = {"Needs Attention": 0, "Average": 1, "Good": 2}
    if order.get(label, 0) > order.get(prediction, 0):
        # Make confidence reflect a deterministic rule.
        return label, max(confidence, 0.95), f"{model_used} + Rules"
    return prediction, confidence, model_used


def _payload_from_student(student: StudentInput) -> dict:
    payload: dict[str, float | int] = {"age": student.age}

    # Fill sem1..sem8.
    # The model was trained on full sem1..sem8 vectors. If the user provides only a subset
    # of semesters, zero-filling can be interpreted as very low performance.
    # To keep behavior intuitive, we forward-fill missing semesters from the nearest
    # previously provided semester, and back-fill leading gaps from the first provided.
    by_sem = {s.semester: s for s in student.semesters}
    provided = sorted(by_sem.keys())
    first = by_sem[provided[0]]

    last_seen = first
    for sem in range(1, 9):
        if sem in by_sem:
            last_seen = by_sem[sem]
        s = last_seen
        payload[f"sem{sem}_internal"] = int(s.internal_marks)
        payload[f"sem{sem}_university"] = int(s.university_marks)
        payload[f"sem{sem}_attendance"] = float(s.attendance)
    return payload


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.on_event("startup")
def _startup() -> None:
    warnings.filterwarnings(
        "ignore",
        message=r"urllib3 v2 only supports OpenSSL.*",
    )
    init_db()


@app.get("/")
def read_root() -> dict:
    return {"message": "Welcome to Student Performance Analyzer!"}


@app.get("/health")
def health_check() -> dict:
    return {"status": "healthy"}


@app.post("/auth/signup", response_model=TokenResponse)
def teacher_signup(payload: TeacherSignup, db: Session = Depends(get_db)) -> TokenResponse:
    existing = db.query(Teacher).filter(Teacher.email == payload.email.lower().strip()).first()
    if existing is not None:
        raise HTTPException(status_code=400, detail="Email already registered")

    teacher = Teacher(
        email=payload.email.lower().strip(),
        password_hash=hash_password(payload.password),
        name=(payload.name or "").strip(),
    )
    db.add(teacher)
    db.commit()
    db.refresh(teacher)

    token = create_access_token(role="teacher", subject_id=teacher.id)
    return TokenResponse(access_token=token)


@app.post("/auth/login", response_model=TokenResponse)
def teacher_login(payload: TeacherLogin, db: Session = Depends(get_db)) -> TokenResponse:
    teacher = db.query(Teacher).filter(Teacher.email == payload.email.lower().strip()).first()
    if teacher is None or not verify_password(payload.password, teacher.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(role="teacher", subject_id=teacher.id)
    return TokenResponse(access_token=token)


@app.post("/auth/student/signup", response_model=TokenResponse)
def student_signup(payload: StudentSignup, db: Session = Depends(get_db)) -> TokenResponse:
    existing = db.query(Student).filter(Student.email == payload.email.lower().strip()).first()
    if existing is not None:
        raise HTTPException(status_code=400, detail="Email already registered")

    student = Student(
        email=payload.email.lower().strip(),
        password_hash=hash_password(payload.password),
        name=(payload.name or "").strip(),
    )
    db.add(student)
    db.commit()
    db.refresh(student)

    token = create_access_token(role="student", subject_id=student.id)
    return TokenResponse(access_token=token)


@app.post("/auth/student/login", response_model=TokenResponse)
def student_login(payload: StudentLogin, db: Session = Depends(get_db)) -> TokenResponse:
    student = db.query(Student).filter(Student.email == payload.email.lower().strip()).first()
    if student is None or not verify_password(payload.password, student.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(role="student", subject_id=student.id)
    return TokenResponse(access_token=token)


@app.post("/predict", response_model=PredictionOutput)
def predict(
    student: StudentInput,
    model_type: Literal["ml", "dl"] = Query("ml"),
    db: Session = Depends(get_db),
    principal: AuthPrincipal = Depends(require_principal),
) -> PredictionOutput:
    try:
        payload = _payload_from_student(student)
        result = predictor.predict(payload, model_type=model_type)
    except ModelArtifactsNotFound as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")

    final_pred, final_conf, final_model_used = _apply_rule_override(
        student=student,
        prediction=result.prediction,
        confidence=result.confidence,
        model_used=result.model_used,
    )

    record = create_prediction_record(
        db,
        student=student,
        prediction=final_pred,
        confidence=final_conf,
        model_used=final_model_used,
        student_id=(principal.id if principal.role == "student" else None),
    )

    return PredictionOutput(
        record_id=record.id,
        department=student.department,
        semesters=student.semesters,
        prediction=final_pred,
        confidence=final_conf,
        model_used=final_model_used,
        feature_contributions=[
            FeatureContribution(
                feature=f,
                value=float(payload.get(f, 0.0)),
                contribution=float(result.contributions.get(f, 0.0)),
            )
            for f in list(payload.keys())
        ],
    )


@app.post("/predict-with-photo", response_model=PredictionOutput)
async def predict_with_photo(
    name: str = Form(...),
    age: int = Form(...),
    department: str = Form(...),
    semesters_json: str = Form(...),
    model_type: Literal["ml", "dl"] = Query("ml"),
    photo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    principal: AuthPrincipal = Depends(require_principal),
) -> PredictionOutput:
    try:
        semesters = json.loads(semesters_json)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid semesters_json: {e}")

    student = StudentInput(name=name, age=age, department=department, semesters=semesters)

    try:
        payload = _payload_from_student(student)
        result = predictor.predict(payload, model_type=model_type)
    except ModelArtifactsNotFound as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")

    final_pred, final_conf, final_model_used = _apply_rule_override(
        student=student,
        prediction=result.prediction,
        confidence=result.confidence,
        model_used=result.model_used,
    )

    record = create_prediction_record(
        db,
        student=student,
        prediction=final_pred,
        confidence=final_conf,
        model_used=final_model_used,
        student_id=(principal.id if principal.role == "student" else None),
    )

    if photo is not None:
        content = await photo.read()
        updated = set_prediction_photo(
            db,
            record_id=record.id,
            photo=content,
            content_type=photo.content_type,
            filename=photo.filename,
        )
        if updated is None:
            raise HTTPException(status_code=404, detail="Record not found")

    return PredictionOutput(
        record_id=record.id,
        department=student.department,
        semesters=student.semesters,
        prediction=final_pred,
        confidence=final_conf,
        model_used=final_model_used,
        feature_contributions=[
            FeatureContribution(
                feature=f,
                value=float(payload.get(f, 0.0)),
                contribution=float(result.contributions.get(f, 0.0)),
            )
            for f in list(payload.keys())
        ],
    )


@app.get("/history")
def history(
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    principal: AuthPrincipal = Depends(require_principal),
) -> List[dict]:
    if principal.role == "teacher":
        records = list_prediction_records(db, limit=limit)
    else:
        records = list_prediction_records_for_student(db, student_id=principal.id, limit=limit)
    return [
        {
            "id": r.id,
            "student_id": r.student_id,
            "name": r.name,
            "department": r.department,
            "age": r.age,
            "avg_percentage": r.avg_percentage,
            "last_percentage": r.last_percentage,
            "avg_attendance": r.avg_attendance,
            "semesters": json.loads(r.semesters_json) if r.semesters_json else [],
            "prediction": r.prediction,
            "confidence": r.confidence,
            "model_used": r.model_used,
            "has_photo": r.photo is not None,
            "created_at": r.created_at.isoformat(),
        }
        for r in records
    ]


@app.get("/records/{record_id}/photo")
def get_record_photo(
    record_id: int,
    db: Session = Depends(get_db),
    principal: AuthPrincipal = Depends(require_principal),
) -> Response:
    from app.database.models import PredictionRecord

    record = db.get(PredictionRecord, record_id)
    if record is None or record.photo is None:
        raise HTTPException(status_code=404, detail="Photo not found")

    if principal.role == "student" and record.student_id != principal.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    media_type = record.photo_content_type or "application/octet-stream"
    return Response(content=record.photo, media_type=media_type)
