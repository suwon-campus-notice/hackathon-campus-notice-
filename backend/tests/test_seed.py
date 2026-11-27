"""시연 데이터가 프론트 예시 데이터(mocks/seed.ts)와 같은 결과를 내는지"""
import pytest

from scripts.seed_demo import seed


@pytest.fixture()
def demo(client, db):
    seed(db)
    assert client.post("/api/auth/login", json={"loginId": "jinwoo", "password": "1234"}).status_code == 200
    return client


def test_seed_teams_and_login(demo):
    teams = demo.get("/api/teams").json()
    assert [(t["name"], len(t["memberIds"])) for t in teams] == [("소프트웨어공학 팀플", 4), ("해커톤 팀", 5), ("데이터과학 프로젝트", 3)]
    assert teams[0]["inviteDaysLeft"] == 5 and teams[0]["leaderId"] == demo.get("/api/auth/me").json()["id"]


def test_seed_matches_frontend_team_availability_test(demo):
    """프론트 teamAvailability.test.ts: 팀 t1 은 2명이 입력했고 민수·서연이 미입력"""
    t1 = demo.get("/api/teams").json()[0]
    r = demo.get(f"/api/teams/{t1['id']}/availability").json()
    assert r["entered"] == 2 and r["total"] == 2 and r["notEntered"] == ["민수", "서연"]


def test_seed_twice_is_refused(db):
    seed(db)
    with pytest.raises(ValueError):
        seed(db)


def test_seed_vote_meeting_and_todos(demo):
    """2차 시연 데이터: 프론트 mocks/seed.ts 와 같은 투표·회의·할 일"""
    t1, t2, _ = demo.get("/api/teams").json()
    s1 = demo.get(f"/api/teams/{t1['id']}/schedule").json()
    assert s1["meeting"] is None and s1["vote"]["ended"] is False and s1["vote"]["hoursLeft"] == 23
    assert [(o["day"], o["start"]) for o in s1["vote"]["options"]] == [(2, 15), (0, 16), (6, 14)]
    me = demo.get("/api/auth/me").json()["id"]
    assert me not in s1["vote"]["ballots"]  # 진우는 아직 투표하지 않음
    assert len(s1["vote"]["ballots"]) == 3
    s2 = demo.get(f"/api/teams/{t2['id']}/schedule").json()
    assert s2["vote"] is None and (s2["meeting"]["day"], s2["meeting"]["start"], s2["meeting"]["votes"]) == (2, 15, 4)
    todos = demo.get(f"/api/teams/{t1['id']}/todos").json()  # 진우는 팀장이라 전체
    assert [g["title"] for g in todos["goals"]] == ["중간 발표 준비", "최종 보고서"]
    assert sorted(t["status"] for t in todos["todos"]) == ["doing", "doing", "doing", "done", "requested"]
