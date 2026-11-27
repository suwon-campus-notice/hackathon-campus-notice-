"""시연용 가짜 데이터 넣기.

    cd backend
    python -m scripts.seed_demo            # 데이터가 비어 있을 때만 넣는다
    python -m scripts.seed_demo --reset    # DB 를 전부 지우고 다시 넣는다 (주의: 모든 데이터가 사라짐)

모두 가짜입니다 (이름·학번·비밀번호). 프론트 mocks/seed.ts 의 예시 데이터와 같은 모양으로 맞췄습니다.
로그인: jinwoo / minsu / jihoon / seoyeon / haneul, 비밀번호는 모두 1234
비밀번호 찾기 답: jinwoo=제주, minsu=민수, 나머지=테스트
(투표·할 일 예시는 2차 때 추가합니다.)
"""
import sys
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.config import settings
from app.db import Base, SessionLocal, engine, init_db, utcnow
from app.security import hash_secret, normalize_answer

Q = settings.security_questions

# (아이디, 이름, 학번, 질문 번호, 답)
USERS = [
    ("jinwoo", "진우", "20231234", 1, "제주"),
    ("minsu", "민수", "20231235", 3, "민수"),
    ("jihoon", "지훈", "20231236", 0, "테스트"),
    ("seoyeon", "서연", "20231237", 0, "테스트"),
    ("haneul", "하늘", "20231238", 0, "테스트"),
]

# (팀 이름, 팀장, 팀원들, 초대 링크 남은 일수, 초대 코드)
TEAMS = [
    ("소프트웨어공학 팀플", "jinwoo", ["jinwoo", "minsu", "jihoon", "seoyeon"], 5, "demoK7Q2xP"),
    ("해커톤 팀", "minsu", ["jinwoo", "minsu", "jihoon", "seoyeon", "haneul"], 3, "demoH4Ck0n"),
    ("데이터과학 프로젝트", "jihoon", ["jinwoo", "jihoon", "seoyeon"], 6, "demoDS2026"),
]

# 아이디 → (요일 0=월, 시작, 종료, 구분). 민수·서연은 아직 입력하지 않은 상태로 둔다.
TIMETABLES = {
    "jinwoo": [(0, 10, 12, "class"), (0, 14, 15.5, "class"), (1, 9, 10.5, "class"), (1, 13, 15, "class"), (2, 10, 12, "class"), (3, 9, 10.5, "class"), (3, 13, 15, "class"), (4, 11, 12, "class"), (5, 9, 21, "blocked")],
    "jihoon": [(0, 10, 12, "class"), (1, 10, 12, "class"), (2, 11, 13, "class"), (3, 9, 10, "class"), (3, 15, 17, "class"), (4, 13, 15, "class"), (5, 14, 18, "blocked")],
    "haneul": [(0, 9, 11, "class"), (0, 13, 15, "class"), (1, 10, 12, "class"), (2, 13, 15, "class"), (3, 10, 12, "class"), (4, 9, 11, "class"), (4, 14, 16, "class")],
}


def seed(db: Session) -> None:
    """가짜 데이터를 넣는다. 이미 jinwoo 가 있으면 아무것도 하지 않고 ValueError."""
    if db.scalar(select(models.User).where(models.User.login_id == "jinwoo")):
        raise ValueError("이미 시연 데이터가 있어요. 처음부터 다시 넣으려면 --reset 을 붙이세요.")
    users = {}
    pw_hash = hash_secret("1234")  # 같은 가짜 비밀번호라 한 번만 계산
    for login_id, name, student_id, q, answer in USERS:
        u = models.User(name=name, login_id=login_id, student_id=student_id, password_hash=pw_hash, question=Q[q], answer_hash=hash_secret(normalize_answer(answer)))
        db.add(u)
        users[login_id] = u
    db.flush()
    for i, (name, leader, members, days_left, code) in enumerate(TEAMS):
        team = models.Team(name=name)
        db.add(team)
        db.flush()
        for m in members:
            db.add(models.TeamMember(team_id=team.id, user_id=users[m].id, role="leader" if m == leader else "member"))
        db.add(models.Invite(team_id=team.id, token=code, expires_at=utcnow() + timedelta(days=days_left, hours=-1)))
    for login_id, entries in TIMETABLES.items():
        for day, start, end, kind in entries:
            db.add(models.TimetableEntry(user_id=users[login_id].id, day=day, start_min=round(start * 60), end_min=round(end * 60), kind=kind))
    db.commit()


def main() -> None:
    if "--reset" in sys.argv:
        Base.metadata.drop_all(engine)
        print("기존 데이터를 모두 지웠어요.")
    init_db()
    with SessionLocal() as db:
        try:
            seed(db)
        except ValueError as e:
            sys.exit(str(e))
    print("시연 데이터를 넣었어요. 아이디: " + ", ".join(u[0] for u in USERS) + " / 비밀번호: 1234")


if __name__ == "__main__":
    main()
