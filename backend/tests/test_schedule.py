"""2차: 회의 시간 투표 · 확정된 회의"""
from datetime import timedelta

from app import models
from app.db import utcnow
from app.services import vote as rules

from test_teams import make_team


def make_group(make_user, names=("jinwoo", "minsu", "jihoon", "seoyeon")):
    """첫 사람이 팀장인 팀을 만들고 나머지가 초대 링크로 참여한다. (팀, 사용자 목록) 을 돌려준다."""
    users = [make_user(n, n) for n in names]
    team = make_team(users[0])
    for u in users[1:]:
        assert u.post(f"/api/invites/{team['inviteCode']}/join").status_code == 200
    return team, users


def url(team, path):
    return f"/api/teams/{team['id']}/{path}"


def create_vote(c, team, slots=((2, 15), (0, 16), (6, 14))):
    return c.post(url(team, "vote"), json={"options": [{"day": d, "start": s} for d, s in slots]})


def option_ids(c, team):
    return [o["id"] for o in c.get(url(team, "schedule")).json()["vote"]["options"]]


def vote(c, team, ids):
    return c.put(url(team, "vote/ballot"), json={"optionIds": ids})


def end_now(db):
    v = db.query(models.Vote).one()
    v.deadline = utcnow() - timedelta(minutes=1)
    db.commit()


# ── 판정 규칙 (프론트 lib/vote.ts 와 같은 결과) ──

def test_majority_is_more_than_half():
    assert [rules.majority(n) for n in (1, 2, 3, 4, 5)] == [1, 2, 2, 3, 3]


def test_decide_rules():
    opts = [1, 2, 3]
    assert rules.decide(opts, {10: {1}, 11: {2}}, 4).kind == "pending"
    d = rules.decide(opts, {10: {1}, 11: {1}, 12: {1, 2}}, 4)
    assert (d.kind, d.option_id, d.votes) == ("confirmed", 1, 3)
    d = rules.decide(opts, {10: {1, 2}, 11: {1, 2}, 12: {1, 2}}, 4)
    assert d.kind == "tie" and set(d.option_ids) == {1, 2}
    # 과반을 넘은 후보 중 표가 가장 많은 후보가 이긴다
    d = rules.decide(opts, {10: {1, 2}, 11: {1, 2}, 12: {1}, 13: {1}}, 4)
    assert (d.kind, d.option_id, d.votes) == ("confirmed", 1, 4)


def test_single_top():
    assert rules.single_top([1, 2], {}) is None
    assert rules.single_top([1, 2], {10: {1}, 11: {2}}) is None
    assert rules.single_top([1, 2], {10: {1}, 11: {1}, 12: {2}}) == 1


# ── 접근 권한 ──

def test_schedule_requires_login_and_membership(client, make_user):
    team, _ = make_group(make_user)
    assert client.get(url(team, "schedule")).status_code == 401
    outsider = make_user("outsider")
    assert outsider.get(url(team, "schedule")).status_code == 404
    assert create_vote(outsider, team).status_code == 404
    assert vote(outsider, team, ["1"]).status_code == 404


def test_empty_schedule(make_user):
    team, (jin, *_) = make_group(make_user)
    assert jin.get(url(team, "schedule")).json() == {"vote": None, "meeting": None}


# ── 투표 만들기 ──

def test_create_vote_shape_matches_types_ts(make_user):
    team, (jin, min_, *_) = make_group(make_user)
    r = create_vote(min_, team)  # 팀원 누구나 만들 수 있다
    assert r.status_code == 201, r.text
    v = r.json()["vote"]
    assert {"id", "teamId", "createdBy", "options", "ballots", "hoursLeft", "revote", "ended"} <= set(v)
    assert v["createdBy"] == min_.user_id and v["teamId"] == team["id"]
    assert [(o["day"], o["start"]) for o in v["options"]] == [(2, 15), (0, 16), (6, 14)]
    assert v["ballots"] == {} and v["revote"] is False and v["ended"] is False
    assert v["hoursLeft"] == 24  # 확정: 24시간


def test_create_vote_validation(make_user):
    team, (jin, *_) = make_group(make_user)
    assert create_vote(jin, team, slots=()).json()["code"] == "invalid_options"
    assert create_vote(jin, team, slots=[(0, 9)] * 2).json()["code"] == "duplicate_option"
    assert create_vote(jin, team, slots=[(7, 9)]).json()["code"] == "invalid_day"
    assert create_vote(jin, team, slots=[(0, 9.25)]).json()["code"] == "invalid_time"
    assert create_vote(jin, team, slots=[(0, 24)]).json()["code"] == "invalid_time"
    seven = [(d, 9) for d in range(7)]
    assert create_vote(jin, team, slots=seven).json()["code"] == "invalid_options"  # 최대 6개
    assert create_vote(jin, team, slots=seven[:6]).status_code == 201


def test_only_one_vote_at_a_time(make_user):
    team, (jin, min_, *_) = make_group(make_user)
    assert create_vote(jin, team).status_code == 201
    r = create_vote(min_, team)
    assert r.status_code == 409 and r.json()["code"] == "vote_exists"


def test_new_vote_replaces_confirmed_meeting(make_user, db):
    team, (jin, min_, ji, seo) = make_group(make_user)
    create_vote(jin, team)
    ids = option_ids(jin, team)
    for u in (min_, ji, seo):
        r = vote(u, team, [ids[0]])
    assert r.json()["meeting"] is not None
    assert create_vote(jin, team).json()["meeting"] is None


# ── 투표하기 ──

def test_cast_and_change_ballot(make_user):
    team, (jin, min_, *_) = make_group(make_user)
    create_vote(jin, team)
    ids = option_ids(jin, team)
    v = vote(min_, team, [ids[0], ids[1]]).json()["vote"]
    assert v["ballots"] == {min_.user_id: sorted([ids[0], ids[1]])}
    # 다른 팀원도 서로의 표를 볼 수 있고, 수정하면 이전 표는 바뀐다
    v = vote(min_, team, [ids[2]]).json()["vote"]
    assert jin.get(url(team, "schedule")).json()["vote"]["ballots"] == {min_.user_id: [ids[2]]}


def test_ballot_validation(make_user):
    team, (jin, *_) = make_group(make_user)
    assert vote(jin, team, ["1"]).json()["code"] == "vote_not_found"  # 투표 없음
    create_vote(jin, team)
    ids = option_ids(jin, team)
    assert vote(jin, team, []).json()["code"] == "invalid_option"
    assert vote(jin, team, ["99999"]).json()["code"] == "invalid_option"
    assert vote(jin, team, ["abc"]).json()["code"] == "invalid_option"
    assert vote(jin, team, [ids[0]]).status_code == 200


def test_majority_confirms_meeting_and_closes_vote(make_user):
    team, (jin, min_, ji, seo) = make_group(make_user)  # 4명 → 과반 3명
    create_vote(jin, team)
    ids = option_ids(jin, team)
    assert vote(jin, team, [ids[0]]).json()["vote"] is not None
    assert vote(min_, team, [ids[0]]).json()["vote"] is not None  # 2명: 아직
    r = vote(ji, team, [ids[0], ids[1]]).json()
    assert r["vote"] is None
    assert r["meeting"] == {"teamId": team["id"], "day": 2, "start": 15, "votes": 3}
    assert seo.get(url(team, "schedule")).json()["meeting"]["day"] == 2


def test_tie_starts_revote_among_top_options(make_user):
    team, (jin, min_, ji, seo) = make_group(make_user)
    create_vote(jin, team)
    ids = option_ids(jin, team)
    vote(jin, team, [ids[0], ids[1]])
    vote(min_, team, [ids[0], ids[1]])
    v = vote(ji, team, [ids[0], ids[1]]).json()["vote"]  # 두 후보 모두 3표
    assert v["revote"] is True
    assert sorted(o["id"] for o in v["options"]) == sorted(ids[:2])  # 동률 후보만 남는다
    assert v["ballots"] == {}  # 표는 초기화
    assert v["hoursLeft"] == 24


# ── 마감 ──

def test_ended_vote(make_user, db):
    team, (jin, min_, ji, seo) = make_group(make_user)
    create_vote(jin, team)
    ids = option_ids(jin, team)
    vote(min_, team, [ids[0]])
    end_now(db)
    v = jin.get(url(team, "schedule")).json()["vote"]
    assert v["ended"] is True and v["hoursLeft"] == 0
    assert vote(jin, team, [ids[0]]).json()["code"] == "vote_ended"


def test_confirm_ended_vote_leader_only(make_user, db):
    team, (jin, min_, ji, seo) = make_group(make_user)
    create_vote(jin, team)
    ids = option_ids(jin, team)
    vote(min_, team, [ids[1]])
    vote(ji, team, [ids[1]])
    assert jin.post(url(team, "vote/confirm")).json()["code"] == "vote_not_ended"
    end_now(db)
    assert min_.post(url(team, "vote/confirm")).status_code == 403
    r = jin.post(url(team, "vote/confirm")).json()
    assert r["vote"] is None and r["meeting"] == {"teamId": team["id"], "day": 0, "start": 16, "votes": 2}


def test_confirm_ended_needs_single_top(make_user, db):
    team, (jin, min_, *_) = make_group(make_user)
    create_vote(jin, team)
    ids = option_ids(jin, team)
    vote(jin, team, [ids[0]])
    vote(min_, team, [ids[1]])
    end_now(db)
    r = jin.post(url(team, "vote/confirm"))
    assert r.status_code == 409 and r.json()["code"] == "no_single_top"
    # 다시 투표
    assert min_.post(url(team, "vote/restart")).status_code == 403
    assert jin.post(url(team, "vote/restart")).json() == {"vote": None, "meeting": None}
    assert create_vote(jin, team).status_code == 201


def test_demo_end_is_leader_only(make_user):
    team, (jin, min_, *_) = make_group(make_user)
    create_vote(jin, team)
    assert min_.post(url(team, "vote/end")).status_code == 403
    assert jin.post(url(team, "vote/end")).json()["vote"]["ended"] is True


# ── 취소 ──

def test_cancel_vote_by_creator_or_leader(make_user):
    team, (jin, min_, ji, _) = make_group(make_user)
    create_vote(min_, team)
    assert ji.delete(url(team, "vote")).status_code == 403  # 만든 사람도 팀장도 아님
    assert min_.delete(url(team, "vote")).json() == {"vote": None, "meeting": None}
    create_vote(min_, team)
    assert jin.delete(url(team, "vote")).json()["vote"] is None  # 팀장
    assert jin.delete(url(team, "vote")).status_code == 404  # 이미 없음


# ── 회의 시간 변경 ──

def test_change_meeting_leader_only(make_user):
    team, (jin, min_, ji, seo) = make_group(make_user)
    assert jin.put(url(team, "meeting"), json={"day": 1, "start": 10}).json()["code"] == "meeting_not_found"
    create_vote(jin, team)
    ids = option_ids(jin, team)
    for u in (jin, min_, ji):
        vote(u, team, [ids[0]])
    assert min_.put(url(team, "meeting"), json={"day": 1, "start": 10}).status_code == 403
    r = jin.put(url(team, "meeting"), json={"day": 1, "start": 10.5}).json()
    assert r["meeting"] == {"teamId": team["id"], "day": 1, "start": 10.5, "votes": 3}
    assert jin.put(url(team, "meeting"), json={"day": 9, "start": 10}).json()["code"] == "invalid_day"
    assert jin.put(url(team, "meeting"), json={"day": 1, "start": 10.2}).json()["code"] == "invalid_time"


# ── 탈퇴 ──

def test_leaving_removes_my_ballots(make_user, db):
    team, (jin, min_, ji, seo) = make_group(make_user)
    create_vote(jin, team)
    ids = option_ids(jin, team)
    vote(min_, team, [ids[0]])
    vote(ji, team, [ids[1]])
    assert min_.post(url(team, "leave")).status_code == 204
    assert jin.get(url(team, "schedule")).json()["vote"]["ballots"] == {ji.user_id: [ids[1]]}


def test_team_delete_removes_vote_and_meeting(make_user, db):
    team, (jin, *_) = make_group(make_user, names=("solo_user",))
    create_vote(jin, team)
    assert jin.post(url(team, "leave")).status_code == 204  # 팀장 혼자인 팀은 삭제
    assert db.query(models.Vote).count() == 0 and db.query(models.VoteOption).count() == 0
