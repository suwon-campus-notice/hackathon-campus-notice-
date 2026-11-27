"""2단계: 가입·로그인·아이디/비밀번호 찾기"""
SIGNUP = {
    "name": "진우",
    "loginId": "jinwoo",
    "password": "1234",
    "studentId": "20231234",
    "question": "가장 기억에 남는 여행지는?",
    "answer": "제주",
}


def signup(client, **over):
    return client.post("/api/auth/signup", json={**SIGNUP, **over})


def test_signup_logs_in_and_returns_user_shape(client):
    r = signup(client)
    assert r.status_code == 201
    body = r.json()
    assert set(body) == {"id", "name", "loginId", "studentId"}  # types.ts 의 User 와 같은 필드
    assert body["loginId"] == "jinwoo" and isinstance(body["id"], str)
    assert client.get("/api/auth/me").json()["name"] == "진우"


def test_me_requires_login(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401 and r.json()["code"] == "not_logged_in"


def test_duplicate_login_id_case_insensitive(client):
    signup(client)
    r = signup(client, loginId="JinWoo")
    assert r.status_code == 409 and r.json()["code"] == "login_id_taken"
    assert client.get("/api/auth/check-id", params={"loginId": "jinwoo"}).json() == {"taken": True}
    assert client.get("/api/auth/check-id", params={"loginId": "other"}).json() == {"taken": False}


def test_signup_validation(client):
    assert signup(client, loginId="a").json()["code"] == "invalid_login_id"
    assert signup(client, loginId="한글아이디").json()["code"] == "invalid_login_id"
    assert signup(client, password="12").json()["code"] == "invalid_password"
    assert signup(client, question="내가 만든 질문?").status_code == 400
    assert signup(client, name="  ").status_code == 400
    assert signup(client, answer=" ").status_code == 400
    assert client.post("/api/auth/signup", json={}).status_code == 422


def test_login_logout(client):
    signup(client)
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/auth/login", json={"loginId": "jinwoo", "password": "틀림"}).status_code == 401
    assert client.post("/api/auth/login", json={"loginId": "nobody", "password": "1234"}).status_code == 401
    assert client.post("/api/auth/login", json={"loginId": "JINWOO", "password": "1234"}).status_code == 200
    assert client.get("/api/auth/me").status_code == 200


def test_cookie_is_httponly_and_limited_to_public_path(client):
    r = signup(client)
    cookie = r.headers["set-cookie"]
    assert "HttpOnly" in cookie and "Path=/" in cookie


def test_password_is_not_stored_in_plain_text(client):
    from app import models
    from app.db import get_db
    from app.main import app

    signup(client)
    s = next(app.dependency_overrides[get_db]())
    u = s.query(models.User).one()
    assert "1234" not in u.password_hash and u.password_hash.startswith("$argon2")
    assert "제주" not in u.answer_hash


def test_find_id(client):
    signup(client)
    assert client.post("/api/auth/find-id", json={"name": "진우", "studentId": "20231234"}).json() == {"loginId": "jinwoo"}
    assert client.post("/api/auth/find-id", json={"name": "진우", "studentId": "0"}).status_code == 404


def test_find_id_is_rate_limited(client):
    for _ in range(5):
        assert client.post("/api/auth/find-id", json={"name": "x", "studentId": "y"}).status_code == 404
    r = client.post("/api/auth/find-id", json={"name": "x", "studentId": "y"})
    assert r.status_code == 429 and r.json()["code"] == "too_many_attempts" and r.json()["retryAfterSeconds"] > 0


def test_password_reset_flow(client):
    signup(client)
    client.post("/api/auth/logout")
    assert client.post("/api/auth/password-question", json={"loginId": "jinwoo"}).json() == {"question": SIGNUP["question"]}
    assert client.post("/api/auth/password-question", json={"loginId": "none"}).status_code == 404
    # 띄어쓰기·대소문자는 무시
    assert client.post("/api/auth/password-check", json={"loginId": "jinwoo", "answer": " 제 주 "}).status_code == 200
    r = client.post("/api/auth/password-reset", json={"loginId": "jinwoo", "answer": "제주", "newPassword": "newpass"})
    assert r.status_code == 200
    assert client.post("/api/auth/login", json={"loginId": "jinwoo", "password": "1234"}).status_code == 401
    assert client.post("/api/auth/login", json={"loginId": "jinwoo", "password": "newpass"}).status_code == 200


def test_wrong_answer_limit_then_blocked_even_if_correct(client):
    signup(client)
    for i in range(5):
        r = client.post("/api/auth/password-check", json={"loginId": "jinwoo", "answer": "서울"})
        assert r.status_code == 400 and r.json()["code"] == "wrong_answer"
        assert r.json()["remainingTries"] == 4 - i
    r = client.post("/api/auth/password-check", json={"loginId": "jinwoo", "answer": "제주"})
    assert r.status_code == 429
    r = client.post("/api/auth/password-reset", json={"loginId": "jinwoo", "answer": "제주", "newPassword": "hack1234"})
    assert r.status_code == 429


def test_correct_answer_resets_fail_count(client):
    signup(client)
    for _ in range(3):
        client.post("/api/auth/password-check", json={"loginId": "jinwoo", "answer": "서울"})
    assert client.post("/api/auth/password-check", json={"loginId": "jinwoo", "answer": "제주"}).status_code == 200
    r = client.post("/api/auth/password-check", json={"loginId": "jinwoo", "answer": "서울"})
    assert r.json()["remainingTries"] == 4


def test_password_change(client):
    signup(client)
    r = client.post("/api/auth/password-change", json={"currentPassword": "틀림", "newPassword": "newpass"})
    assert r.status_code == 400 and r.json()["code"] == "wrong_password"
    assert client.post("/api/auth/password-change", json={"currentPassword": "1234", "newPassword": "newpass"}).status_code == 200
    client.post("/api/auth/logout")
    assert client.post("/api/auth/login", json={"loginId": "jinwoo", "password": "newpass"}).status_code == 200


def test_password_change_requires_login(client):
    assert client.post("/api/auth/password-change", json={"currentPassword": "a", "newPassword": "bbbb"}).status_code == 401


def test_questions_list(client):
    assert len(client.get("/api/auth/questions").json()) == 10


def test_cookie_path_follows_public_base_url(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "public_base_url", "https://example.ac.kr:5400/262ac24018070")
    cookie = signup(client).headers["set-cookie"]
    assert "Path=/262ac24018070/" in cookie and "Secure" in cookie
