"""2차: 목표 · 할 일"""
from app import models

from test_schedule import make_group, url


def goal_body(title, todos):
    return {"title": title, "todos": [{"title": t, "assigneeId": a, "due": d, **({"id": i} if i else {})} for t, a, d, i in todos]}


def make_goal(c, team, users, title="중간 발표"):
    jin, min_, ji, _ = users
    body = goal_body(title, [("자료 작성", min_.user_id, "2026-12-01", None), ("대본 작성", ji.user_id, "2026-12-02", None), ("내 할 일", jin.user_id, "2026-12-03", None)])
    r = c.post(url(team, "goals"), json=body)
    assert r.status_code == 201, r.text
    return r.json()


def todo_id(data, title):
    return next(t["id"] for t in data["todos"] if t["title"] == title)


def test_requires_login_and_membership(client, make_user):
    team, _ = make_group(make_user)
    assert client.get(url(team, "todos")).status_code == 401
    assert make_user("outsider").get(url(team, "todos")).status_code == 404


def test_create_goal_leader_only_and_shape(make_user):
    team, users = make_group(make_user)
    jin, min_, ji, _ = users
    body = goal_body("g", [("t", min_.user_id, "2026-12-01", None)])
    assert min_.post(url(team, "goals"), json=body).status_code == 403
    data = make_goal(jin, team, users)
    assert data["goals"] == [{"id": data["goalId"], "teamId": team["id"], "title": "중간 발표"}]
    t = next(x for x in data["todos"] if x["title"] == "자료 작성")
    assert t == {"id": t["id"], "goalId": data["goalId"], "teamId": team["id"], "title": "자료 작성", "assigneeId": min_.user_id, "due": "2026-12-01", "status": "doing", "note": ""}


def test_visibility_leader_all_member_own(make_user):
    team, users = make_group(make_user)
    jin, min_, ji, seo = users
    make_goal(jin, team, users)
    assert len(jin.get(url(team, "todos")).json()["todos"]) == 3
    mine = min_.get(url(team, "todos")).json()
    assert [t["title"] for t in mine["todos"]] == ["자료 작성"]
    assert len(mine["goals"]) == 1  # 목표 이름은 보이되 남의 할 일은 안 보인다
    assert seo.get(url(team, "todos")).json()["todos"] == []


def test_create_goal_validation(make_user):
    team, users = make_group(make_user)
    jin = users[0]
    outsider = make_user("outsider")
    ok = ("t", users[1].user_id, "2026-12-01", None)
    assert jin.post(url(team, "goals"), json=goal_body("  ", [ok])).json()["code"] == "invalid_input"
    assert jin.post(url(team, "goals"), json=goal_body("g", [("", users[1].user_id, "2026-12-01", None)])).json()["code"] == "invalid_input"
    assert jin.post(url(team, "goals"), json=goal_body("g", [("t", outsider.user_id, "2026-12-01", None)])).json()["code"] == "invalid_assignee"
    assert jin.post(url(team, "goals"), json=goal_body("g", [("t", "abc", "2026-12-01", None)])).json()["code"] == "invalid_assignee"
    for bad in ("2026-13-01", "12/01", "2026-02-30", ""):
        assert jin.post(url(team, "goals"), json=goal_body("g", [("t", users[1].user_id, bad, None)])).json()["code"] == "invalid_due"


def test_update_goal_edit_drop_add(make_user):
    team, users = make_group(make_user)
    jin, min_, ji, seo = users
    data = make_goal(jin, team, users)
    gid = data["goalId"]
    keep = todo_id(data, "자료 작성")
    body = goal_body("바뀐 이름", [("자료 수정", ji.user_id, "2026-12-10", keep), ("새 할 일", seo.user_id, "2026-12-11", None)])
    assert min_.put(url(team, f"goals/{gid}"), json=body).status_code == 403
    out = jin.put(url(team, f"goals/{gid}"), json=body).json()
    assert out["goals"][0]["title"] == "바뀐 이름"
    assert sorted(t["title"] for t in out["todos"]) == ["새 할 일", "자료 수정"]  # 보내지 않은 기존 할 일은 삭제
    edited = next(t for t in out["todos"] if t["id"] == keep)
    assert (edited["assigneeId"], edited["due"]) == (ji.user_id, "2026-12-10")
    # 이 목표에 없는 할 일 id 는 거절
    bad = goal_body("x", [("t", ji.user_id, "2026-12-10", "99999")])
    assert jin.put(url(team, f"goals/{gid}"), json=bad).json()["code"] == "invalid_input"
    assert jin.put(url(team, "goals/99999"), json=body).json()["code"] == "goal_not_found"


def test_delete_goal_removes_todos(make_user, db):
    team, users = make_group(make_user)
    jin, min_, *_ = users
    data = make_goal(jin, team, users)
    assert min_.delete(url(team, f"goals/{data['goalId']}")).status_code == 403
    out = jin.delete(url(team, f"goals/{data['goalId']}")).json()
    assert out == {"goals": [], "todos": []}
    assert db.query(models.Todo).count() == 0


def test_status_flow_request_then_confirm(make_user):
    team, users = make_group(make_user)
    jin, min_, ji, _ = users
    data = make_goal(jin, team, users)
    tid = todo_id(data, "자료 작성")
    # 담당자가 수행 내용을 적고 완료 요청
    out = min_.post(url(team, f"todos/{tid}/request"), json={"note": " 초안을 썼어요 "}).json()
    t = out["todos"][0]
    assert (t["status"], t["note"]) == ("requested", "초안을 썼어요")
    assert min_.post(url(team, f"todos/{tid}/request"), json={"note": "x"}).json()["code"] == "invalid_status"  # 이미 요청함
    # 팀원은 확인할 수 없고 팀장만 확인 완료
    assert min_.post(url(team, f"todos/{tid}/confirm")).status_code == 403
    done = jin.post(url(team, f"todos/{tid}/confirm")).json()
    assert next(x for x in done["todos"] if x["id"] == tid)["status"] == "done"
    assert jin.post(url(team, f"todos/{tid}/confirm")).json()["code"] == "invalid_status"


def test_confirm_requires_requested_and_request_requires_assignee(make_user):
    team, users = make_group(make_user)
    jin, min_, ji, _ = users
    data = make_goal(jin, team, users)
    tid = todo_id(data, "자료 작성")
    assert jin.post(url(team, f"todos/{tid}/confirm")).json()["code"] == "invalid_status"  # 아직 진행 중
    assert jin.post(url(team, f"todos/{tid}/request"), json={"note": "x"}).json()["code"] == "assignee_only"  # 팀장도 담당자만 요청
    assert ji.post(url(team, f"todos/{tid}/request"), json={"note": "x"}).status_code == 404  # 남의 할 일은 있는지도 모른다


def test_leader_confirms_own_todo(make_user):
    team, users = make_group(make_user)
    jin = users[0]
    data = make_goal(jin, team, users)
    tid = todo_id(data, "내 할 일")
    jin.post(url(team, f"todos/{tid}/request"), json={"note": "했다"})
    out = jin.post(url(team, f"todos/{tid}/confirm")).json()
    assert next(t for t in out["todos"] if t["id"] == tid)["status"] == "done"


def test_note_rules(make_user):
    team, users = make_group(make_user)
    jin, min_, ji, _ = users
    data = make_goal(jin, team, users)
    tid = todo_id(data, "자료 작성")
    assert min_.put(url(team, f"todos/{tid}/note"), json={"note": "중간 저장"}).json()["todos"][0]["note"] == "중간 저장"
    assert jin.put(url(team, f"todos/{tid}/note"), json={"note": "팀장이 진행 중에 수정"}).json()["code"] == "invalid_status"
    min_.post(url(team, f"todos/{tid}/request"), json={"note": "완료"})
    assert min_.put(url(team, f"todos/{tid}/note"), json={"note": "요청 중 수정"}).json()["code"] == "invalid_status"
    jin.post(url(team, f"todos/{tid}/confirm"))
    # 확인 완료 뒤에는 담당자와 팀장 모두 고칠 수 있다
    assert min_.put(url(team, f"todos/{tid}/note"), json={"note": "담당자 수정"}).status_code == 200
    out = jin.put(url(team, f"todos/{tid}/note"), json={"note": "팀장 수정"}).json()
    assert next(t for t in out["todos"] if t["id"] == tid)["note"] == "팀장 수정"
    assert min_.put(url(team, f"todos/{tid}/note"), json={"note": "x" * 5001}).json()["code"] == "invalid_input"


def test_team_delete_removes_goals(make_user, db):
    team, users = make_group(make_user, names=("solo_user",))
    jin = users[0]
    assert jin.post(url(team, "goals"), json=goal_body("g", [("t", jin.user_id, "2026-12-01", None)])).status_code == 201
    jin.post(url(team, "leave"))
    assert db.query(models.Goal).count() == 0 and db.query(models.Todo).count() == 0
