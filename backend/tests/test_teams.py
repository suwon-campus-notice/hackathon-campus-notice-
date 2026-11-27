"""3단계: 팀 만들기·초대·참여·팀장 넘기기·탈퇴"""
from datetime import timedelta

from app import models
from app.db import utcnow


def make_team(c, name="소프트웨어공학 팀플"):
    r = c.post("/api/teams", json={"name": name})
    assert r.status_code == 201, r.text
    return r.json()


def expire(db, team_id, days=-1):
    inv = db.query(models.Invite).filter_by(team_id=int(team_id)).one()
    inv.expires_at = utcnow() + timedelta(days=days)
    db.commit()


def test_team_requires_login(client):
    assert client.get("/api/teams").status_code == 401
    assert client.post("/api/teams", json={"name": "a"}).status_code == 401


def test_create_team_shape_matches_types_ts(make_user):
    jin = make_user("jinwoo", "진우")
    t = make_team(jin)
    assert {"id", "name", "leaderId", "memberIds", "inviteCode", "inviteDaysLeft"} <= set(t)
    assert t["leaderId"] == jin.user_id and t["memberIds"] == [jin.user_id]
    assert t["inviteDaysLeft"] == 7  # 확정: 7일
    assert t["members"] == [{"id": jin.user_id, "name": "진우"}]
    assert jin.get("/api/teams").json() == [t]


def test_invite_days_follow_setting(make_user, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "invite_expire_days", 3)
    assert make_team(make_user("jinwoo"))["inviteDaysLeft"] == 3


def test_empty_team_name_rejected(make_user):
    assert make_user("jinwoo").post("/api/teams", json={"name": "  "}).status_code == 400


def test_join_with_invite(make_user):
    jin, minsu = make_user("jinwoo", "진우"), make_user("minsu", "민수")
    t = make_team(jin)
    preview = minsu.get(f"/api/invites/{t['inviteCode']}").json()
    assert preview["expired"] is False and preview["team"]["name"] == t["name"]
    r = minsu.post(f"/api/invites/{t['inviteCode']}/join")
    assert r.status_code == 200
    assert r.json()["memberIds"] == [jin.user_id, minsu.user_id] and r.json()["leaderId"] == jin.user_id
    assert [x["id"] for x in minsu.get("/api/teams").json()] == [t["id"]]
    # 이미 팀원이면 다시 눌러도 그대로
    assert minsu.post(f"/api/invites/{t['inviteCode']}/join").json()["memberIds"] == [jin.user_id, minsu.user_id]


def test_one_person_in_many_teams(make_user):
    jin, minsu = make_user("jinwoo"), make_user("minsu")
    a, b = make_team(jin, "A"), make_team(minsu, "B")
    jin.post(f"/api/invites/{b['inviteCode']}/join")
    assert [t["name"] for t in jin.get("/api/teams").json()] == ["A", "B"]


def test_unknown_invite(make_user):
    c = make_user("jinwoo")
    assert c.get("/api/invites/nothing").json()["code"] == "invite_not_found"
    assert c.post("/api/invites/nothing/join").status_code == 404


def test_expired_invite_cannot_join_but_preview_says_expired(make_user, db):
    jin, minsu = make_user("jinwoo"), make_user("minsu")
    t = make_team(jin)
    expire(db, t["id"])
    assert minsu.get(f"/api/invites/{t['inviteCode']}").json()["expired"] is True
    r = minsu.post(f"/api/invites/{t['inviteCode']}/join")
    assert r.status_code == 410 and r.json()["code"] == "invite_expired"
    assert minsu.get("/api/teams").json() == []


def test_renew_invalidates_old_link_immediately(make_user, db):
    jin, minsu = make_user("jinwoo"), make_user("minsu")
    t = make_team(jin)
    expire(db, t["id"])
    new = jin.post(f"/api/teams/{t['id']}/invite/renew").json()
    assert new["inviteCode"] != t["inviteCode"] and new["inviteDaysLeft"] == 7
    assert minsu.post(f"/api/invites/{t['inviteCode']}/join").status_code == 404  # 옛 링크
    assert minsu.post(f"/api/invites/{new['inviteCode']}/join").status_code == 200


def test_renew_even_before_expiry_kills_old_link(make_user):
    jin, minsu = make_user("jinwoo"), make_user("minsu")
    t = make_team(jin)
    jin.post(f"/api/teams/{t['id']}/invite/renew")
    assert minsu.post(f"/api/invites/{t['inviteCode']}/join").status_code == 404


def test_only_leader_can_renew_and_transfer(make_user):
    jin, minsu = make_user("jinwoo"), make_user("minsu")
    t = make_team(jin)
    minsu.post(f"/api/invites/{t['inviteCode']}/join")
    r = minsu.post(f"/api/teams/{t['id']}/invite/renew")
    assert r.status_code == 403 and r.json()["code"] == "leader_only"
    assert minsu.post(f"/api/teams/{t['id']}/leader", json={"userId": minsu.user_id}).status_code == 403


def test_non_member_cannot_see_team(make_user):
    jin, outsider = make_user("jinwoo"), make_user("outsider")
    t = make_team(jin)
    assert outsider.get(f"/api/teams/{t['id']}").status_code == 404
    assert outsider.post(f"/api/teams/{t['id']}/invite/renew").status_code == 404
    assert outsider.post(f"/api/teams/{t['id']}/leave").status_code == 404
    assert jin.get("/api/teams/abc").status_code == 404


def test_transfer_leader(make_user):
    jin, minsu = make_user("jinwoo"), make_user("minsu")
    t = make_team(jin)
    minsu.post(f"/api/invites/{t['inviteCode']}/join")
    r = jin.post(f"/api/teams/{t['id']}/leader", json={"userId": minsu.user_id})
    assert r.status_code == 200 and r.json()["leaderId"] == minsu.user_id
    # 이제 진우는 팀장이 아니다
    assert jin.post(f"/api/teams/{t['id']}/invite/renew").status_code == 403
    assert minsu.post(f"/api/teams/{t['id']}/invite/renew").status_code == 200


def test_transfer_target_must_be_other_member(make_user):
    jin, minsu, outsider = make_user("jinwoo"), make_user("minsu"), make_user("outsider")
    t = make_team(jin)
    minsu.post(f"/api/invites/{t['inviteCode']}/join")
    for bad in (jin.user_id, outsider.user_id, "999", "abc"):
        r = jin.post(f"/api/teams/{t['id']}/leader", json={"userId": bad})
        assert r.status_code == 400 and r.json()["code"] == "invalid_target"


def test_member_can_leave_and_rejoin_needs_link(make_user):
    jin, minsu = make_user("jinwoo"), make_user("minsu")
    t = make_team(jin)
    minsu.post(f"/api/invites/{t['inviteCode']}/join")
    assert minsu.post(f"/api/teams/{t['id']}/leave").status_code == 204
    assert minsu.get(f"/api/teams/{t['id']}").status_code == 404
    assert jin.get(f"/api/teams/{t['id']}").json()["memberIds"] == [jin.user_id]


def test_leader_must_transfer_before_leaving(make_user):
    jin, minsu = make_user("jinwoo"), make_user("minsu")
    t = make_team(jin)
    minsu.post(f"/api/invites/{t['inviteCode']}/join")
    r = jin.post(f"/api/teams/{t['id']}/leave")
    assert r.status_code == 409 and r.json()["code"] == "leader_must_transfer"
    jin.post(f"/api/teams/{t['id']}/leader", json={"userId": minsu.user_id})
    assert jin.post(f"/api/teams/{t['id']}/leave").status_code == 204
    assert minsu.get(f"/api/teams/{t['id']}").json()["leaderId"] == minsu.user_id


def test_sole_leader_leaving_deletes_team(make_user, db):
    jin = make_user("jinwoo")
    t = make_team(jin)
    assert jin.post(f"/api/teams/{t['id']}/leave").status_code == 204
    assert jin.get("/api/teams").json() == []
    assert db.query(models.Team).count() == 0 and db.query(models.TeamMember).count() == 0 and db.query(models.Invite).count() == 0
    assert make_user("minsu").get(f"/api/invites/{t['inviteCode']}").status_code == 404  # 링크도 사라짐


def test_no_kick_endpoint(make_user):
    jin, minsu = make_user("jinwoo"), make_user("minsu")
    t = make_team(jin)
    minsu.post(f"/api/invites/{t['inviteCode']}/join")
    for method, path in (("delete", f"/api/teams/{t['id']}/members/{minsu.user_id}"), ("post", f"/api/teams/{t['id']}/kick")):
        assert getattr(jin, method)(path).status_code in (404, 405)
