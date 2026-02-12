from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, model_validator


TOTAL_OUT_OF = 600
INTERNAL_OUT_OF = 300
UNIVERSITY_OUT_OF = 300


class SemesterInput(BaseModel):
    semester: int = Field(..., ge=1, le=8)
    internal_marks: int = Field(..., ge=0, le=INTERNAL_OUT_OF)
    university_marks: int = Field(..., ge=0, le=UNIVERSITY_OUT_OF)
    attendance: float = Field(..., ge=0, le=100)

    @model_validator(mode="after")
    def _total_check(self) -> "SemesterInput":
        if self.internal_marks + self.university_marks > TOTAL_OUT_OF:
            raise ValueError("internal_marks + university_marks must be <= 600")
        return self


class StudentInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=120, description="Student name")
    age: int = Field(..., ge=15, le=30, description="Student age (15-30)")
    department: str = Field(..., min_length=2, max_length=80, description="Department")
    semesters: List[SemesterInput] = Field(..., min_length=1, max_length=8)

    @model_validator(mode="after")
    def _unique_semesters(self) -> "StudentInput":
        sems = [s.semester for s in self.semesters]
        if len(set(sems)) != len(sems):
            raise ValueError("Duplicate semesters are not allowed")
        return self


class FeatureContribution(BaseModel):
    feature: str
    value: float
    contribution: float


class PredictionOutput(BaseModel):
    record_id: int
    department: Optional[str] = None
    semesters: List[SemesterInput] = Field(default_factory=list)
    prediction: str
    confidence: float = Field(..., ge=0, le=1)
    model_used: str
    feature_contributions: List[FeatureContribution]
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    model_config = {
        "protected_namespaces": (),
    }
