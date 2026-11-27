"""DB 표 정의. (1차: users, sessions, attempts / 팀·시간표는 3·4단계에서 추가)

id 는 숫자로 저장하고, API 에서는 문자열로 내보낸다 (프론트 types.ts 가 문자열 id).
"""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base, utcnow


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50))
    login_id: Mapped[str] = mapped_column(String(50), unique=True, index=True)  # 소문자로 저장
    student_id: Mapped[str] = mapped_column(String(30))
    password_hash: Mapped[str] = mapped_column(String(255))
    question: Mapped[str] = mapped_column(String(200))  # 비밀번호 찾기 질문(글자 그대로)
    answer_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class LoginSession(Base):
    """로그인 상태. 쿠키에는 랜덤 토큰을, 여기에는 그 토큰의 해시만 저장한다."""

    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)


class Attempt(Base):
    """시도 횟수 제한용 기록. kind='answer'(찾기 답 틀림, key=아이디) / 'find_id'(key=접속 주소)"""

    __tablename__ = "attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(20), index=True)
    key: Mapped[str] = mapped_column(String(100), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class TeamMember(Base):
    """팀 소속 정보. 팀장/팀원 역할(role)은 사용자가 아니라 여기에 저장한다.
    2차 표(투표·할 일 등)도 team_id 로 이어 붙이고, 팀이 지워지면 함께 지워지게(CASCADE) 한다."""

    __tablename__ = "team_members"
    __table_args__ = (UniqueConstraint("team_id", "user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(10))  # 'leader' 또는 'member' (상수는 routers/teams.py)
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Invite(Base):
    """팀의 초대 링크. 팀마다 하나뿐이고, 새로 만들면 토큰을 바꿔서 옛 링크는 바로 무효가 된다.
    만료는 만료 시각(expires_at)으로 판단한다."""

    __tablename__ = "invites"

    id: Mapped[int] = mapped_column(primary_key=True)
    team_id: Mapped[int] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"), unique=True)
    token: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)


class TimetableEntry(Base):
    """내가 바쁜 시간 하나. 시간은 '분'(정수)으로 저장한다 (9시 30분 = 570). 하루 전체(0~1440)를 저장할 수 있다.
    시간표는 개인 하나이고 모든 팀이 공유한다 (docs/screens.md 가정)."""

    __tablename__ = "timetable_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    day: Mapped[int] = mapped_column(Integer)  # 0=월 … 6=일
    start_min: Mapped[int] = mapped_column(Integer)
    end_min: Mapped[int] = mapped_column(Integer)
    kind: Mapped[str] = mapped_column(String(10))  # 'class' | 'blocked'
