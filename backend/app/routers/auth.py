"""가입·로그인·아이디/비밀번호 찾기. 모든 경로는 api/auth/... (상대 경로로 호출)"""
import re

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..errors import ApiError
from ..models import User
from ..security import (
    check_limit,
    clear_attempts,
    count_attempts,
    client_key,
    current_user,
    end_session,
    hash_secret,
    normalize_answer,
    record_attempt,
    start_session,
    verify_secret,
)

router = APIRouter(prefix="/api/auth", tags=["계정"])


# ── 요청·응답 모양 (필드 이름은 프론트 types.ts 의 User 와 같다) ──

class UserOut(BaseModel):
    id: str
    name: str
    loginId: str
    studentId: str


def user_out(u: User) -> UserOut:
    return UserOut(id=str(u.id), name=u.name, loginId=u.login_id, studentId=u.student_id)


class SignupIn(BaseModel):
    name: str
    loginId: str
    password: str
    studentId: str
    question: str
    answer: str


class LoginIn(BaseModel):
    loginId: str
    password: str


class FindIdIn(BaseModel):
    name: str
    studentId: str


class LoginIdIn(BaseModel):
    loginId: str


class AnswerIn(BaseModel):
    loginId: str
    answer: str


class ResetIn(BaseModel):
    loginId: str
    answer: str
    newPassword: str


class ChangePasswordIn(BaseModel):
    currentPassword: str
    newPassword: str


# ── 검사 도우미 ──

def bad(message: str, code: str = "invalid_input") -> ApiError:
    return ApiError(400, code, message)


def norm_login_id(value: str) -> str:
    return value.strip().lower()  # 아이디는 대소문자를 구분하지 않는다 (임의)


def check_login_id(login_id: str) -> None:
    lo, hi = settings.login_id_min, settings.login_id_max
    if not (lo <= len(login_id) <= hi) or not re.fullmatch(r"[a-z0-9_]+", login_id):
        raise bad(f"아이디는 영문·숫자·밑줄(_) {lo}~{hi}자로 입력해 주세요.", "invalid_login_id")


def check_password(password: str) -> None:
    if not (settings.password_min <= len(password) <= 128):
        raise bad(f"비밀번호는 {settings.password_min}자 이상으로 입력해 주세요.", "invalid_password")


def find_user(db: Session, login_id: str) -> User | None:
    return db.scalar(select(User).where(User.login_id == norm_login_id(login_id)))


# ── API ──

@router.get("/questions", summary="비밀번호 찾기 질문 목록")
def questions() -> list[str]:
    return settings.security_questions


@router.get("/check-id", summary="아이디 중복 확인")
def check_id(loginId: str, db: Session = Depends(get_db)):
    login_id = norm_login_id(loginId)
    check_login_id(login_id)
    return {"taken": find_user(db, login_id) is not None}


@router.post("/signup", summary="회원가입 (가입하면 바로 로그인됨)", status_code=201)
def signup(body: SignupIn, response: Response, db: Session = Depends(get_db)) -> UserOut:
    name, student_id = body.name.strip(), body.studentId.strip()
    login_id = norm_login_id(body.loginId)
    if not name or len(name) > 50:
        raise bad("이름을 입력해 주세요.")
    if not student_id or len(student_id) > 30:
        raise bad("학번을 입력해 주세요.")
    check_login_id(login_id)
    check_password(body.password)
    if body.question not in settings.security_questions:
        raise bad("찾기 질문을 목록에서 골라 주세요.")
    if not normalize_answer(body.answer):
        raise bad("찾기 질문의 답을 입력해 주세요.")
    if find_user(db, login_id):  # 화면의 '중복 확인' 뒤에도 서버가 한 번 더 확인
        raise ApiError(409, "login_id_taken", "이미 사용 중인 아이디예요. 다른 아이디를 입력해 주세요.")
    user = User(
        name=name,
        login_id=login_id,
        student_id=student_id,
        password_hash=hash_secret(body.password),
        question=body.question,
        answer_hash=hash_secret(normalize_answer(body.answer)),
    )
    db.add(user)
    db.commit()
    start_session(db, response, user)
    return user_out(user)


@router.post("/login", summary="로그인")
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)) -> UserOut:
    user = find_user(db, body.loginId)
    if not user or not verify_secret(user.password_hash, body.password):
        raise ApiError(401, "login_failed", "아이디 또는 비밀번호가 맞지 않아요.")
    start_session(db, response, user)
    return user_out(user)


@router.post("/logout", summary="로그아웃", status_code=204)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    end_session(db, request, response)


@router.get("/me", summary="지금 로그인한 사용자 (로그인 안 했으면 401)")
def me(user: User = Depends(current_user)) -> UserOut:
    return user_out(user)


@router.post("/find-id", summary="아이디 찾기 (이름 + 학번)")
def find_id(body: FindIdIn, request: Request, db: Session = Depends(get_db)):
    key = client_key(request)
    check_limit(db, "find_id", key, settings.find_id_max_tries, settings.find_id_window_minutes)
    record_attempt(db, "find_id", key)  # 맞든 틀리든 한 번으로 센다
    user = db.scalar(select(User).where(User.name == body.name.strip(), User.student_id == body.studentId.strip()))
    if not user:
        raise ApiError(404, "not_found", "입력한 이름과 학번으로 가입한 계정이 없어요.")
    return {"loginId": user.login_id}


@router.post("/password-question", summary="비밀번호 찾기 1단계: 아이디로 질문 받기")
def password_question(body: LoginIdIn, db: Session = Depends(get_db)):
    user = find_user(db, body.loginId)
    if not user:
        raise ApiError(404, "not_found", "없는 아이디예요.")
    return {"question": user.question}


def verify_answer(db: Session, login_id: str, answer: str) -> User:
    """질문의 답 확인. 틀리면 횟수를 세고, 제한을 넘으면 막는다."""
    user = find_user(db, login_id)
    if not user:
        raise ApiError(404, "not_found", "없는 아이디예요.")
    check_limit(db, "answer", user.login_id, settings.answer_max_fails, settings.answer_block_minutes)
    if not verify_secret(user.answer_hash, normalize_answer(answer)):
        record_attempt(db, "answer", user.login_id)
        left = max(0, settings.answer_max_fails - count_attempts(db, "answer", user.login_id, settings.answer_block_minutes)[0])
        raise ApiError(400, "wrong_answer", "답이 맞지 않아요.", remainingTries=left)
    clear_attempts(db, "answer", user.login_id)
    return user


@router.post("/password-check", summary="비밀번호 찾기 2단계: 질문의 답 확인")
def password_check(body: AnswerIn, db: Session = Depends(get_db)):
    verify_answer(db, body.loginId, body.answer)
    return {"ok": True}


@router.post("/password-reset", summary="비밀번호 찾기 3단계: 새 비밀번호 설정 (답을 한 번 더 보내야 함)")
def password_reset(body: ResetIn, db: Session = Depends(get_db)):
    check_password(body.newPassword)
    user = verify_answer(db, body.loginId, body.answer)
    user.password_hash = hash_secret(body.newPassword)
    db.commit()
    return {"ok": True}


@router.post("/password-change", summary="비밀번호 변경 (로그인한 상태)")
def password_change(body: ChangePasswordIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not verify_secret(user.password_hash, body.currentPassword):
        raise ApiError(400, "wrong_password", "현재 비밀번호가 맞지 않아요.")
    check_password(body.newPassword)
    user.password_hash = hash_secret(body.newPassword)
    db.commit()
    return {"ok": True}
