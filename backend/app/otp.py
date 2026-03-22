from __future__ import annotations

import secrets
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.database.models import OTPRecord

OTP_EXPIRY_MINUTES = 5
RESEND_COOLDOWN_SECONDS = 60


def generate_otp() -> str:
    return "".join(secrets.choice("0123456789") for _ in range(6))


def create_otp_record(
    db: Session,
    *,
    email: str,
    purpose: str,
    role: str,
    payload_json: Optional[str] = None,
) -> OTPRecord:
    # Invalidate any existing unexpired OTPs for same email+purpose+role
    db.query(OTPRecord).filter(
        OTPRecord.email == email,
        OTPRecord.purpose == purpose,
        OTPRecord.role == role,
        OTPRecord.verified == False,  # noqa: E712
    ).delete()

    otp = OTPRecord(
        email=email,
        otp_code=generate_otp(),
        purpose=purpose,
        role=role,
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES),
        payload_json=payload_json,
    )
    db.add(otp)
    db.commit()
    db.refresh(otp)
    return otp


def verify_otp(
    db: Session,
    *,
    email: str,
    otp_code: str,
    purpose: str,
    role: str,
) -> Optional[OTPRecord]:
    record = (
        db.query(OTPRecord)
        .filter(
            OTPRecord.email == email,
            OTPRecord.purpose == purpose,
            OTPRecord.role == role,
            OTPRecord.verified == False,  # noqa: E712
        )
        .order_by(OTPRecord.created_at.desc())
        .first()
    )

    if record is None:
        return None

    if datetime.utcnow() > record.expires_at:
        return None

    if record.otp_code != otp_code:
        return None

    record.verified = True
    db.commit()
    db.refresh(record)
    return record


def can_resend_otp(db: Session, *, email: str, purpose: str, role: str) -> bool:
    latest = (
        db.query(OTPRecord)
        .filter(
            OTPRecord.email == email,
            OTPRecord.purpose == purpose,
            OTPRecord.role == role,
        )
        .order_by(OTPRecord.created_at.desc())
        .first()
    )

    if latest is None:
        return True

    elapsed = (datetime.utcnow() - latest.created_at).total_seconds()
    return elapsed >= RESEND_COOLDOWN_SECONDS


def cleanup_expired_otps(db: Session) -> int:
    cutoff = datetime.utcnow() - timedelta(minutes=30)
    count = db.query(OTPRecord).filter(OTPRecord.created_at < cutoff).delete()
    db.commit()
    return count
