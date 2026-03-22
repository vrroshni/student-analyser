from __future__ import annotations

import os

from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

conf = ConnectionConfig(
    MAIL_USERNAME=os.environ.get("MAIL_USERNAME", ""),
    MAIL_PASSWORD=os.environ.get("MAIL_PASSWORD", ""),
    MAIL_FROM=os.environ.get("MAIL_FROM", os.environ.get("MAIL_USERNAME", "")),
    MAIL_PORT=int(os.environ.get("MAIL_PORT", "587")),
    MAIL_SERVER=os.environ.get("MAIL_SERVER", "smtp.gmail.com"),
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,
)

fast_mail = FastMail(conf)


async def send_otp_email(to_email: str, otp_code: str) -> None:
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a;">Student Performance Analyzer</h2>
        <p>Your verification code is:</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center;
                    padding: 16px; background: #f4f4f5; border-radius: 8px; margin: 16px 0;">
            {otp_code}
        </div>
        <p style="color: #71717a; font-size: 14px;">
            This code expires in <strong>5 minutes</strong>. Do not share it with anyone.
        </p>
    </div>
    """

    message = MessageSchema(
        subject="Your Verification Code",
        recipients=[to_email],
        body=html,
        subtype=MessageType.html,
    )
    await fast_mail.send_message(message)
