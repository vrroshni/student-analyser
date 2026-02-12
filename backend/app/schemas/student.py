from __future__ import annotations

from datetime import datetime
from typing import List

from pydantic import BaseModel, Field


class StudentInput(BaseModel):
    age: int = Field(..., ge=15, le=30, description="Student age (15-30)")
    internal_marks: float = Field(..., ge=0, le=100, description="Internal assessment marks (0-100)")
    previous_marks: float = Field(..., ge=0, le=100, description="Previous exam marks (0-100)")
    attendance: float = Field(..., ge=0, le=100, description="Attendance percentage (0-100)")


class FeatureContribution(BaseModel):
    feature: str
    value: float
    contribution: float


class PredictionOutput(BaseModel):
    prediction: str
    confidence: float = Field(..., ge=0, le=1)
    model_used: str
    feature_contributions: List[FeatureContribution]
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    model_config = {
        "protected_namespaces": (),
    }
