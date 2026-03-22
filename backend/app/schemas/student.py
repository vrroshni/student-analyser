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
    department: str = Field(..., min_length=2, max_length=80, description="Department")
    semesters: List[SemesterInput] = Field(..., min_length=1, max_length=8)

    @model_validator(mode="after")
    def _unique_semesters(self) -> "StudentInput":
        sems = [s.semester for s in self.semesters]
        if len(set(sems)) != len(sems):
            raise ValueError("Duplicate semesters are not allowed")
        return self

    @model_validator(mode="after")
    def _validate_data_quality(self) -> "StudentInput":
        """Validate that the student data is semantically meaningful and not clearly bad/incomplete."""
        sems = self.semesters
        
        # Check if all marks are zero (clearly incomplete/bad data)
        all_marks_zero = all(
            s.internal_marks == 0 and s.university_marks == 0 
            for s in sems
        )
        if all_marks_zero:
            raise ValueError("Invalid data: All semester marks are zero. Please enter actual marks.")
        
        # Calculate average percentage
        percentages = [
            ((s.internal_marks + s.university_marks) / TOTAL_OUT_OF) * 100.0 
            for s in sems
        ]
        avg_percentage = sum(percentages) / len(percentages) if percentages else 0.0
        
        # Reject extremely low average (below 5%) as likely data entry error
        if avg_percentage < 5.0:
            raise ValueError(
                f"Invalid data: Average percentage is {avg_percentage:.1f}%, which is extremely low. "
                "Please verify the marks are entered correctly."
            )
        
        # Check if all attendance values are zero
        all_attendance_zero = all(s.attendance == 0 for s in sems)
        if all_attendance_zero and len(sems) > 0:
            raise ValueError("Invalid data: Attendance cannot be 0% for all semesters. Please enter actual attendance.")
        
        # Check for unrealistic combination: very high marks with 0 attendance
        if all_attendance_zero and avg_percentage > 70.0:
            raise ValueError(
                "Invalid data: Cannot have high marks (>70%) with 0% attendance in all semesters. "
                "Please verify the data."
            )
        
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
