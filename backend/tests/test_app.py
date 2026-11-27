"""1단계: 서버 뼈대 테스트 (상태 확인, 문서 주소, 화면 파일 제공)"""
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

client = TestClient(app)  # (DB 를 쓰지 않는 요청만 사용)


def test_health():
    assert client.get("/api/health").json() == {"ok": True}


def test_docs_uses_relative_openapi_path():
    html = client.get("/docs").text
    assert "url: 'openapi.json'" in html  # 절대 경로(/openapi.json)면 /<아이디>/ 아래에서 깨진다


def test_no_slash_redirect():
    assert client.get("/api/health/", follow_redirects=False).status_code == 404


def test_unknown_api_is_404_not_html():
    assert client.get("/api/nothing").status_code == 404


def test_guide_page_when_no_build(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "frontend_dist", tmp_path / "none")
    assert "Coetus" in client.get("/").text


def test_serves_built_frontend_and_blocks_traversal(tmp_path, monkeypatch):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("INDEX")
    (dist / "a.js").write_text("JS")
    (tmp_path / "secret.txt").write_text("SECRET")
    monkeypatch.setattr(settings, "frontend_dist", dist)
    assert client.get("/").text == "INDEX"
    assert client.get("/a.js").text == "JS"
    assert client.get("/%2e%2e/secret.txt").text == "INDEX"  # dist 밖 파일은 내보내지 않는다
