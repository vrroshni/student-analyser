from __future__ import annotations

import warnings
from typing import Generator, List, Literal, Optional

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database.crud import create_prediction_record, list_prediction_records, set_prediction_photo
from app.database.db import SessionLocal, init_db
from app.schemas import FeatureContribution, PredictionOutput, StudentInput
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


@app.post("/predict", response_model=PredictionOutput)
def predict(
    student: StudentInput,
    model_type: Literal["ml", "dl"] = Query("ml"),
    db: Session = Depends(get_db),
) -> PredictionOutput:
    try:
        result = predictor.predict(student.model_dump(), model_type=model_type)
    except ModelArtifactsNotFound as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")

    record = create_prediction_record(
        db,
        student=student,
        prediction=result.prediction,
        confidence=result.confidence,
        model_used=result.model_used,
    )

    return PredictionOutput(
        record_id=record.id,
        prediction=result.prediction,
        confidence=result.confidence,
        model_used=result.model_used,
        feature_contributions=[
            FeatureContribution(
                feature=f,
                value=float(getattr(student, f)),
                contribution=float(result.contributions.get(f, 0.0)),
            )
            for f in ["age", "internal_marks", "previous_marks", "attendance"]
        ],
    )


@app.post("/predict-with-photo", response_model=PredictionOutput)
async def predict_with_photo(
    name: str = Form(...),
    age: int = Form(...),
    internal_marks: float = Form(...),
    previous_marks: float = Form(...),
    attendance: float = Form(...),
    model_type: Literal["ml", "dl"] = Query("ml"),
    photo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
) -> PredictionOutput:
    student = StudentInput(
        name=name,
        age=age,
        internal_marks=internal_marks,
        previous_marks=previous_marks,
        attendance=attendance,
    )

    try:
        result = predictor.predict(student.model_dump(), model_type=model_type)
    except ModelArtifactsNotFound as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {e}")

    record = create_prediction_record(
        db,
        student=student,
        prediction=result.prediction,
        confidence=result.confidence,
        model_used=result.model_used,
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
        prediction=result.prediction,
        confidence=result.confidence,
        model_used=result.model_used,
        feature_contributions=[
            FeatureContribution(
                feature=f,
                value=float(getattr(student, f)),
                contribution=float(result.contributions.get(f, 0.0)),
            )
            for f in ["age", "internal_marks", "previous_marks", "attendance"]
        ],
    )


@app.get("/history")
def history(
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
) -> List[dict]:
    records = list_prediction_records(db, limit=limit)
    return [
        {
            "id": r.id,
            "name": r.name,
            "age": r.age,
            "internal_marks": r.internal_marks,
            "previous_marks": r.previous_marks,
            "attendance": r.attendance,
            "prediction": r.prediction,
            "confidence": r.confidence,
            "model_used": r.model_used,
            "has_photo": r.photo is not None,
            "created_at": r.created_at.isoformat(),
        }
        for r in records
    ]


@app.get("/records/{record_id}/photo")
def get_record_photo(record_id: int, db: Session = Depends(get_db)) -> Response:
    from app.database.models import PredictionRecord

    record = db.get(PredictionRecord, record_id)
    if record is None or record.photo is None:
        raise HTTPException(status_code=404, detail="Photo not found")

    media_type = record.photo_content_type or "application/octet-stream"
    return Response(content=record.photo, media_type=media_type)
