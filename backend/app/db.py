"""DB 연결. 기본은 SQLite 파일 (backend/data/coetus.db, ~/work 안이라 서버를 꺼도 남는다)."""
from collections.abc import Iterator
from datetime import datetime, timezone

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import BACKEND_DIR, settings


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime:
    """DB 에는 항상 UTC 기준(시간대 표시 없는 값)으로 저장한다."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def make_engine(url: str):
    if url.startswith("sqlite"):
        (BACKEND_DIR / "data").mkdir(exist_ok=True)
    engine = create_engine(url, connect_args={"check_same_thread": False} if url.startswith("sqlite") else {})
    if url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def _fk_on(conn, _):  # SQLite 는 기본으로 외래키 검사를 끄므로 켠다
            conn.execute("PRAGMA foreign_keys=ON")

    return engine


engine = make_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    with SessionLocal() as db:
        yield db


def init_db() -> None:
    from . import models  # noqa: F401  (표 정의를 불러와야 create_all 이 만든다)

    Base.metadata.create_all(engine)
