import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app import db as dbmod
from app.config import settings
from app.main import app


@pytest.fixture()
def Session(tmp_path, monkeypatch):
    """테스트마다 새 DB 파일을 쓴다 (실제 DB 는 건드리지 않는다)"""
    # .env 의 공개 주소(https, /<아이디>/)와 상관없이 테스트는 http://testserver/ 로 한다
    monkeypatch.setattr(settings, "public_base_url", "http://testserver/")
    engine = dbmod.make_engine(f"sqlite:///{tmp_path / 'test.db'}")
    from app import models  # noqa: F401

    dbmod.Base.metadata.create_all(engine)
    maker = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override():
        with maker() as s:
            yield s

    app.dependency_overrides[dbmod.get_db] = override
    yield maker
    app.dependency_overrides.clear()


@pytest.fixture()
def client(Session):
    return TestClient(app)


@pytest.fixture()
def db(Session):
    """테스트 안에서 DB 를 직접 보거나 고칠 때"""
    with Session() as s:
        yield s


@pytest.fixture()
def make_user(Session):
    """로그인된 새 사용자(별도 쿠키)를 만든다.  user = make_user('minsu')"""

    def make(login_id: str, name: str | None = None) -> TestClient:
        c = TestClient(app)
        r = c.post(
            "/api/auth/signup",
            json={"name": name or login_id, "loginId": login_id, "password": "1234", "studentId": "1", "question": settings.security_questions[0], "answer": "a"},
        )
        assert r.status_code == 201, r.text
        c.user_id = r.json()["id"]
        return c

    return make
