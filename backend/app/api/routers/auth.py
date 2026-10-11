"""
Lumen OS Auth Router - OTP Generation, Verification & Rate Limiting
"""

import time
import secrets
import hashlib
import hmac
import os
import re
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, HTTPException, Request

router = APIRouter(prefix="/auth", tags=["auth"])

# In-memory temporary cache for OTPs
# key: email -> { "hashed_otp": str, "salt": str, "expires_at": float, "attempts": int, "last_sent_at": float, "purpose": str }
_otp_store: dict[str, dict] = {}

# In-memory rate limiting store
# key: identifier -> { "count": int, "reset_at": float }
_rate_limit_store: dict[str, dict] = {}

OTP_TTL_SECONDS = 300            # 5 minutes
RESEND_COOLDOWN_SECONDS = 60     # 60 seconds cooldown
MAX_ATTEMPTS = 5                 # Max verification attempts
RATE_LIMIT_WINDOW_SECONDS = 900  # 15 minutes
MAX_REQUESTS_PER_WINDOW = 6      # Max 6 OTP requests per 15 mins


class SendOtpRequest(BaseModel):
    email: str
    purpose: Optional[str] = "signup"


class VerifyOtpRequest(BaseModel):
    email: str
    otp: str
    purpose: Optional[str] = "signup"


def _check_rate_limit(key: str) -> bool:
    now = time.time()
    current = _rate_limit_store.get(key)
    if not current or now > current["reset_at"]:
        _rate_limit_store[key] = {"count": 1, "reset_at": now + RATE_LIMIT_WINDOW_SECONDS}
        return True
    if current["count"] >= MAX_REQUESTS_PER_WINDOW:
        return False
    current["count"] += 1
    return True


def _hash_otp(otp: str, salt: str) -> str:
    secret = os.getenv("OTP_SECRET", "lumen-secure-secret-2026")
    payload = f"{otp}:{salt}:{secret}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def _send_email_smtp(to_email: str, otp: str, purpose: str) -> dict:
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    from_email = os.getenv("SMTP_FROM", "security@lumen.ai")

    subject = (
        "Welcome to Lumen OS — Your Verification Code"
        if purpose == "signup"
        else "Lumen OS — Your Login Verification Code"
    )

    if smtp_host and smtp_user and smtp_pass:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"Lumen Health OS <{from_email}>"
            msg["To"] = to_email

            text_content = f"Your Lumen OS verification code is: {otp}. It will expire in 5 minutes."
            html_content = f"""
            <div style="font-family: sans-serif; background-color: #050b08; color: #f8fafc; padding: 30px; border-radius: 16px;">
                <h2 style="color: #10b981;">Lumen Health OS</h2>
                <p>Use the one-time code below to verify your email address (<strong>{to_email}</strong>):</p>
                <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; padding: 20px; font-size: 32px; font-weight: bold; letter-spacing: 6px; text-align: center; color: #10b981; border-radius: 10px;">
                    {otp}
                </div>
                <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">Valid for 5 minutes. If you did not request this code, you can ignore this email.</p>
            </div>
            """
            msg.attach(MIMEText(text_content, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                if smtp_port != 465:
                    server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(from_email, [to_email], msg.as_string())
            return {"sent": True, "simulated": False}
        except Exception as e:
            print(f"[AUTH SMTP ERROR] Failed sending to {to_email}: {e}")

    # Simulated Preview fallback when SMTP credentials are not yet configured in env
    print(f"\n📧 [LUMEN EMAIL DISPATCH] Verification OTP for {to_email}: >>> {otp} <<< (Expires in 5 mins)\n")
    return {"sent": True, "simulated": True}


@router.post("/send-otp")
async def send_otp(payload: SendOtpRequest, request: Request):
    email = payload.email.strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise HTTPException(status_code=400, detail="Invalid email format")

    client_ip = request.client.host if request.client else "unknown"
    if not _check_rate_limit(f"ip:{client_ip}") or not _check_rate_limit(f"email:{email}"):
        raise HTTPException(
            status_code=429,
            detail="Too many OTP requests. Please wait a few minutes before trying again.",
        )

    now = time.time()
    existing = _otp_store.get(email)
    if existing and (now - existing["last_sent_at"] < RESEND_COOLDOWN_SECONDS):
        remaining = int(RESEND_COOLDOWN_SECONDS - (now - existing["last_sent_at"]))
        raise HTTPException(
            status_code=429,
            detail=f"Please wait {remaining} seconds before requesting a new code.",
        )

    # Generate 6-digit OTP
    otp = f"{secrets.randbelow(900000) + 100000:06d}"
    salt = secrets.token_hex(16)
    hashed_otp = _hash_otp(otp, salt)

    _otp_store[email] = {
        "hashed_otp": hashed_otp,
        "salt": salt,
        "expires_at": now + OTP_TTL_SECONDS,
        "attempts": 0,
        "last_sent_at": now,
        "purpose": payload.purpose or "signup",
    }

    result = _send_email_smtp(email, otp, payload.purpose or "signup")

    response_data = {
        "success": True,
        "message": f"Verification code sent to {email}",
        "expires_in_seconds": OTP_TTL_SECONDS,
    }
    if result.get("simulated"):
        response_data["dev_otp"] = otp

    return response_data


@router.post("/verify-otp")
async def verify_otp(payload: VerifyOtpRequest):
    email = payload.email.strip().lower()
    otp = payload.otp.strip()

    if not re.match(r"^\d{6}$", otp):
        raise HTTPException(status_code=400, detail="OTP must be exactly 6 digits.")

    record = _otp_store.get(email)
    if not record:
        raise HTTPException(
            status_code=400,
            detail="No active verification code found for this email. Please request a new code.",
        )

    now = time.time()
    if now > record["expires_at"]:
        _otp_store.pop(email, None)
        raise HTTPException(
            status_code=400,
            detail="Verification code has expired. Please request a new code.",
        )

    if record["attempts"] >= MAX_ATTEMPTS:
        _otp_store.pop(email, None)
        raise HTTPException(
            status_code=429,
            detail="Maximum failed attempts exceeded. Please request a new code.",
        )

    computed_hash = _hash_otp(otp, record["salt"])
    if not hmac.compare_digest(computed_hash, record["hashed_otp"]):
        record["attempts"] += 1
        remaining = MAX_ATTEMPTS - record["attempts"]
        raise HTTPException(
            status_code=400,
            detail=f"Incorrect verification code. {remaining} attempt(s) remaining.",
        )

    # Verification successful: remove OTP to prevent replay attacks
    _otp_store.pop(email, None)
    session_token = secrets.token_hex(32)

    return {
        "success": True,
        "verified": True,
        "message": "Email address verified successfully",
        "token": session_token,
        "email": email,
    }
