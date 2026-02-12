from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, Integer, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class PredictionRecord(Base):
    __tablename__ = "prediction_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    name: Mapped[Optional[str]] = mapped_column(String, nullable=True, default="")

    age: Mapped[int] = mapped_column(Integer, nullable=False)
    internal_marks: Mapped[float] = mapped_column(Float, nullable=False)
    previous_marks: Mapped[float] = mapped_column(Float, nullable=False)
    attendance: Mapped[float] = mapped_column(Float, nullable=False)

    prediction: Mapped[str] = mapped_column(String, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    model_used: Mapped[str] = mapped_column(String, nullable=False)

    photo: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    photo_content_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    photo_filename: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
