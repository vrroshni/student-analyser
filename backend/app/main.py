from __future__ import annotations

import json
import os
import uuid
import warnings

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
from typing import Generator, List, Literal, Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session

from app.auth import AuthPrincipal, create_access_token, get_current_teacher, hash_password, require_principal, verify_password
from app.database.crud import create_csv_students_batch, create_prediction_record, list_csv_students_for_teacher, list_prediction_records, list_prediction_records_for_student, set_prediction_photo
from app.database.db import SessionLocal, init_db
from app.database.models import Student, Teacher
from app.email import send_otp_email
from app.otp import can_resend_otp, cleanup_expired_otps, create_otp_record, verify_otp
from app.services.csv_processor import generate_template_csv, validate_and_parse_csv
from app.schemas import (
    FeatureContribution,
    OTPSentResponse,
    OTPVerifyRequest,
    PredictionOutput,
    ResendOTPRequest,
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
    allow_origins=[
        "http://localhost:3000",
        os.getenv("FRONTEND_URL", ""),
        "https://student-analyser.vercel.app",
    ],
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
    payload: dict[str, float | int] = {}

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
    db = SessionLocal()
    try:
        cleanup_expired_otps(db)
    finally:
        db.close()


@app.get("/")
def read_root() -> dict:
    return {"message": "Welcome to Student Performance Analyzer!"}


@app.get("/health")
def health_check() -> dict:
    return {"status": "healthy"}


@app.post("/auth/signup", response_model=OTPSentResponse)
async def teacher_signup(payload: TeacherSignup, db: Session = Depends(get_db)) -> OTPSentResponse:
    email = payload.email.lower().strip()
    existing = db.query(Teacher).filter(Teacher.email == email).first()
    if existing is not None:
        raise HTTPException(status_code=400, detail="Email already registered")

    payload_data = json.dumps({
        "password_hash": hash_password(payload.password),
        "name": (payload.name or "").strip(),
    })
    otp_record = create_otp_record(db, email=email, purpose="signup", role="teacher", payload_json=payload_data)
    await send_otp_email(email, otp_record.otp_code)
    return OTPSentResponse(email=email)


@app.post("/auth/login", response_model=OTPSentResponse)
async def teacher_login(payload: TeacherLogin, db: Session = Depends(get_db)) -> OTPSentResponse:
    email = payload.email.lower().strip()
    teacher = db.query(Teacher).filter(Teacher.email == email).first()
    if teacher is None:
        raise HTTPException(status_code=401, detail="No account found with this email")

    otp_record = create_otp_record(db, email=email, purpose="login", role="teacher")
    await send_otp_email(email, otp_record.otp_code)
    return OTPSentResponse(email=email)


@app.post("/auth/student/signup", response_model=OTPSentResponse)
async def student_signup(payload: StudentSignup, db: Session = Depends(get_db)) -> OTPSentResponse:
    email = payload.email.lower().strip()
    existing = db.query(Student).filter(Student.email == email).first()
    if existing is not None:
        raise HTTPException(status_code=400, detail="Email already registered")

    payload_data = json.dumps({
        "password_hash": hash_password(payload.password),
        "name": (payload.name or "").strip(),
    })
    otp_record = create_otp_record(db, email=email, purpose="signup", role="student", payload_json=payload_data)
    await send_otp_email(email, otp_record.otp_code)
    return OTPSentResponse(email=email)


@app.post("/auth/student/login", response_model=OTPSentResponse)
async def student_login(payload: StudentLogin, db: Session = Depends(get_db)) -> OTPSentResponse:
    email = payload.email.lower().strip()
    student = db.query(Student).filter(Student.email == email).first()
    if student is None:
        raise HTTPException(status_code=401, detail="No account found with this email")

    otp_record = create_otp_record(db, email=email, purpose="login", role="student")
    await send_otp_email(email, otp_record.otp_code)
    return OTPSentResponse(email=email)


@app.post("/auth/verify-otp", response_model=TokenResponse)
def verify_otp_route(payload: OTPVerifyRequest, db: Session = Depends(get_db)) -> TokenResponse:
    record = verify_otp(
        db,
        email=payload.email.lower().strip(),
        otp_code=payload.otp_code,
        purpose=payload.purpose,
        role=payload.role,
    )
    if record is None:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP. Please request a new one.")

    email = record.email

    if record.purpose == "signup":
        data = json.loads(record.payload_json or "{}")
        if record.role == "teacher":
            # Check again in case of race condition
            if db.query(Teacher).filter(Teacher.email == email).first() is not None:
                raise HTTPException(status_code=400, detail="Email already registered")
            user = Teacher(email=email, password_hash=data["password_hash"], name=data.get("name", ""))
            db.add(user)
            db.commit()
            db.refresh(user)
            token = create_access_token(role="teacher", subject_id=user.id)
        else:
            if db.query(Student).filter(Student.email == email).first() is not None:
                raise HTTPException(status_code=400, detail="Email already registered")
            user = Student(email=email, password_hash=data["password_hash"], name=data.get("name", ""))
            db.add(user)
            db.commit()
            db.refresh(user)
            token = create_access_token(role="student", subject_id=user.id)
    else:
        # Login — user already exists
        if record.role == "teacher":
            teacher = db.query(Teacher).filter(Teacher.email == email).first()
            if teacher is None:
                raise HTTPException(status_code=400, detail="Account not found")
            token = create_access_token(role="teacher", subject_id=teacher.id)
        else:
            student = db.query(Student).filter(Student.email == email).first()
            if student is None:
                raise HTTPException(status_code=400, detail="Account not found")
            token = create_access_token(role="student", subject_id=student.id)

    return TokenResponse(access_token=token)


@app.post("/auth/resend-otp", response_model=OTPSentResponse)
async def resend_otp_route(payload: ResendOTPRequest, db: Session = Depends(get_db)) -> OTPSentResponse:
    email = payload.email.lower().strip()

    if not can_resend_otp(db, email=email, purpose=payload.purpose, role=payload.role):
        raise HTTPException(status_code=429, detail="Please wait before requesting a new code")

    otp_record = create_otp_record(db, email=email, purpose=payload.purpose, role=payload.role)
    await send_otp_email(email, otp_record.otp_code)
    return OTPSentResponse(email=email)


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
        model_accuracy=result.model_accuracy,
    )


@app.post("/predict-with-photo", response_model=PredictionOutput)
async def predict_with_photo(
    name: str = Form(...),
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

    student = StudentInput(name=name, department=department, semesters=semesters)

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
        model_accuracy=result.model_accuracy,
    )


@app.post("/csv/upload")
async def upload_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
) -> dict:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a .csv file")

    content = await file.read()
    parsed_rows, errors = validate_and_parse_csv(content)

    if errors:
        raise HTTPException(
            status_code=422,
            detail={
                "message": f"CSV validation failed: {len(errors)} error(s) found",
                "errors": errors,
            },
        )

    batch_id = str(uuid.uuid4())
    records = create_csv_students_batch(
        db,
        teacher_id=teacher.id,
        upload_batch=batch_id,
        rows=parsed_rows,
    )

    return {
        "count": len(records),
        "upload_batch": batch_id,
        "students": [
            {
                "id": r.id,
                "name": r.name,
                "department": r.department,
                "semesters": json.loads(r.semesters_json),
                "upload_batch": r.upload_batch,
                "created_at": r.created_at.isoformat(),
            }
            for r in records
        ],
    }


@app.get("/csv/students")
def list_csv_students(
    db: Session = Depends(get_db),
    teacher: Teacher = Depends(get_current_teacher),
) -> List[dict]:
    records = list_csv_students_for_teacher(db, teacher_id=teacher.id)
    return [
        {
            "id": r.id,
            "name": r.name,
            "department": r.department,
            "semesters": json.loads(r.semesters_json),
            "upload_batch": r.upload_batch,
            "created_at": r.created_at.isoformat(),
        }
        for r in records
    ]


@app.get("/csv/template")
def download_csv_template() -> StreamingResponse:
    csv_content = generate_template_csv()
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=student_template.csv"},
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
