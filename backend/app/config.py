"""설정값 모음.

(임의) 표시가 붙은 값은 팀 회의에서 정해지지 않아 임시로 채운 값입니다.
바꾸고 싶으면 이 파일을 고치지 말고 backend/.env 에 같은 이름(대문자)으로 적으면 됩니다.
예) INVITE_EXPIRE_DAYS=14
"""
from pathlib import Path
from urllib.parse import urlparse

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    # ── 주소·파일 위치 ──
    # 공개 주소 (서버마다 다름). 초대 링크 / 쿠키 경로에 사용
    public_base_url: str = "http://localhost:6000/"
    # 빌드된 화면 파일 위치 (프론트에서 npm run build 하면 생김)
    frontend_dist: Path = REPO_DIR / "frontend" / "dist"
    # DB 파일은 ~/work 안에 둔다 (밖에 두면 서버를 끌 때 사라짐). GitHub 에는 안 올라감
    database_url: str = f"sqlite:///{BACKEND_DIR / 'data' / 'coetus.db'}"

    # 비밀번호 찾기 질문 (프론트 mocks/seed.ts 의 SECURITY_QUESTIONS 와 같은 10개)
    security_questions: list[str] = [
        "어릴 적 가장 좋아했던 장난감은?",
        "가장 기억에 남는 여행지는?",
        "처음 키운 반려동물이나 식물의 이름은?",
        "어릴 적 별명은?",
        "처음으로 본 영화 제목은?",
        "가장 오래 다닌 학원이나 동아리 이름은?",
        "어릴 적 살던 동네 이름은?",
        "가장 좋아하는 책 제목은?",
        "처음 받아 본 선물은?",
        "가장 기억에 남는 수업 이름은?",
    ]

    # ── 팀 ──
    invite_expire_days: int = 7  # 확정(회의 내용): 초대 링크 7일 후 만료

    # ── 계정 ──
    login_id_min: int = 3  # (임의)
    login_id_max: int = 20  # (임의)
    password_min: int = 4  # (임의) 예시 계정 비밀번호가 1234 라서 맞춤
    session_days: int = 14  # (임의) 로그인 유지 기간
    session_cookie_name: str = "coetus_session"  # 같은 도메인의 다른 앱과 겹치지 않게 고유 이름

    # ── 시도 횟수 제한 (임의) ──
    answer_max_fails: int = 5  # 확정: 찾기 질문 답 틀릴 수 있는 횟수
    answer_block_minutes: int = 15  # (미정→임의) 5회 초과 시 막는 시간
    find_id_max_tries: int = 5  # (임의) 아이디 찾기 시도 횟수
    find_id_window_minutes: int = 10  # (임의) 위 횟수를 세는 시간 범위

    # ── 시간표 ──
    timetable_slot_minutes: int = 30  # 확정: 30분 단위
    timetable_kinds: list[str] = ["class", "blocked"]  # 수업 / 활동 불가

    # ── 공통 공강 계산 범위 (임의, 미정) ──
    availability_start_hour: int = 9
    availability_end_hour: int = 21

    # ── 투표 (2차) ──
    vote_hours: int = 24  # 확정: 투표 기한 24시간 (동률 재투표를 시작할 때도 새로 24시간 (임의))
    vote_max_options: int = 6  # (임의) 후보 최대 개수 (추천 시간 + 직접 추가한 시간)

    # ── 목표·할 일 (2차, 임의) ──
    goal_max_todos: int = 50  # 목표 하나에 담을 수 있는 할 일 수

    @property
    def public_base_path(self) -> str:
        """공개 주소의 경로 부분. 예) /262ac24018070/ (쿠키 경로로 사용)"""
        path = urlparse(self.public_base_url).path or "/"
        return path if path.endswith("/") else path + "/"

    @property
    def public_base(self) -> str:
        """끝에 / 가 붙은 공개 주소"""
        return self.public_base_url.rstrip("/") + "/"


settings = Settings()
