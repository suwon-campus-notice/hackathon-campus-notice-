"""비밀번호·답 해시, 로그인 세션, 시도 횟수 제한."""
import hashlib
import re
import secrets
from datetime import timedelta

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, Request, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db, utcnow
from .errors import ApiError
from .models import Attempt, LoginSession, User

_hasher = PasswordHasher()


def hash_secret(value: str) -> str:
    return _hasher.hash(value)


def verify_secret(hashed: str, value: str) -> bool:
    try:
        return _hasher.verify(hashed, value)
    except (VerificationError, InvalidHashError):
        return False


def normalize_answer(answer: str) -> str:
    """찾기 답은 띄어쓰기·대소문자를 무시하고 비교한다 (프론트 checkAnswer 와 같은 규칙)"""
    return re.sub(r"\s+", "", answer).lower()


# ── 로그인 세션 ──

def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def start_session(db: Session, response: Response, user: User) -> None:
    token = secrets.token_urlsafe(32)
    db.add(LoginSession(token_hash=_token_hash(token), user_id=user.id, expires_at=utcnow() + timedelta(days=settings.session_days)))
    db.commit()
    response.set_cookie(
        settings.session_cookie_name,
        token,
        max_age=settings.session_days * 86400,
        path=settings.public_base_path,  # /<아이디>/ 아래에서만 쓴다 (같은 도메인의 다른 앱과 분리)
        httponly=True,
        samesite="lax",
        secure=settings.public_base_url.startswith("https"),
    )


def end_session(db: Session, request: Request, response: Response) -> None:
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        row = db.scalar(select(LoginSession).where(LoginSession.token_hash == _token_hash(token)))
        if row:
            db.delete(row)
            db.commit()
    response.delete_cookie(settings.session_cookie_name, path=settings.public_base_path)


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """로그인한 사용자. 아니면 401. 보호할 API 에 Depends(current_user) 를 붙인다."""
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        row = db.scalar(select(LoginSession).where(LoginSession.token_hash == _token_hash(token)))
        if row and row.expires_at > utcnow():
            user = db.get(User, row.user_id)
            if user:
                return user
    raise ApiError(401, "not_logged_in", "로그인이 필요해요.")


# ── 시도 횟수 제한 ──

def count_attempts(db: Session, kind: str, key: str, minutes: int) -> tuple[int, Attempt | None]:
    since = utcnow() - timedelta(minutes=minutes)
    cond = (Attempt.kind == kind, Attempt.key == key, Attempt.created_at >= since)
    n = db.scalar(select(func.count()).select_from(Attempt).where(*cond)) or 0
    oldest = db.scalar(select(Attempt).where(*cond).order_by(Attempt.created_at).limit(1))
    return n, oldest


def check_limit(db: Session, kind: str, key: str, max_tries: int, minutes: int) -> None:
    """기록된 시도가 max_tries 에 이르면 429. (기록은 record_attempt 로 따로 남긴다)"""
    n, oldest = count_attempts(db, kind, key, minutes)
    if n >= max_tries:
        # 가장 최근 시도로부터 minutes 분 뒤에 풀린다
        last = db.scalar(select(func.max(Attempt.created_at)).where(Attempt.kind == kind, Attempt.key == key))
        wait = max(1, int((last + timedelta(minutes=minutes) - utcnow()).total_seconds()))
        raise ApiError(429, "too_many_attempts", f"시도가 너무 많아요. {-(-wait // 60)}분 뒤에 다시 해 주세요.", retryAfterSeconds=wait)


def record_attempt(db: Session, kind: str, key: str) -> None:
    db.add(Attempt(kind=kind, key=key))
    db.commit()


def clear_attempts(db: Session, kind: str, key: str) -> None:
    for a in db.scalars(select(Attempt).where(Attempt.kind == kind, Attempt.key == key)):
        db.delete(a)
    db.commit()


def client_key(request: Request) -> str:
    """접속한 쪽 주소. 프록시 뒤라서 X-Forwarded-For 가 있으면 그 첫 값을 쓴다."""
    fwd = request.headers.get("x-forwarded-for")
    return (fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown"))[:100]
