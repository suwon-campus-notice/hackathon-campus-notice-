"""Coetus 테스트 서버 — 여러 기기가 같은 팀 데이터를 보게 하는 최소 백엔드.

테스트 계정(팀장, 팀원1~4 / 비밀번호 1234, 한 팀 "테스트 팀"):
- 서버가 비어 있을 때 올라온 예시 데이터에 서버가 테스트 계정·팀을 덧붙인다.
- 테스트 계정은 한 번에 한 사람만 쓴다: /api/lock/acquire 로 잠그고, 활동이 있을 때 heartbeat, 10분 활동이 없으면 풀린다.
- /api/test-reset 에 암호를 보내면 테스트 계정·팀만 예시 상태로 되돌린다. 다른 계정과 팀은 그대로 둔다.

- frontend/dist(빌드한 화면)와 /api 를 한 프로세스(6000 포트)로 서빙한다.
- 앱 상태(사용자, 팀, 시간표, 투표, 회의, 목표, 할 일, 계정)를 backend/data/state.json 한 문서에 통째로 저장한다.
- 규칙(과반 판정, 겹침 검사 등)은 프런트의 src/store 가 그대로 담당하고, 서버는 문서를 보관·배포만 한다.
- 동시 수정은 version 으로 막는다: PUT 의 base 가 현재 version 과 다르면 409 와 최신 문서를 돌려주고,
  프런트가 최신 문서 위에 자기 변경을 다시 적용해 보낸다.
- 처음 켜면 state 가 null 이다. 첫 클라이언트가 예시 데이터(seed)를 올린다. POST /api/reset 도 같은 효과.

정식 백엔드(FastAPI + PostgreSQL, 서버 측 인증)가 생기면 이 파일은 지운다. 테스트용이라 비밀번호가 문서 안에 그대로 들어 있다.
"""
from __future__ import annotations

import json
import secrets
import threading
import time
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parents[1]           # backend/
DATA_DIR = ROOT / "data"
STATE_FILE = DATA_DIR / "state.json"
LOCK_FILE = DATA_DIR / "locks.json"
DIST_DIR = ROOT.parent / "frontend" / "dist"

_lock = threading.Lock()

# ---------- 테스트 계정·팀 ----------
TEST_RESET_PASSWORD = "개추우면개추26016025"
IDLE_SECONDS = 10 * 60            # 10분 활동이 없으면 자동 로그아웃
TEST_TEAM_ID = "tteam"
TEST_USERS = [
    {"id": "tu1", "name": "팀장", "loginId": "leader", "studentId": "20260001"},
    {"id": "tu2", "name": "팀원1", "loginId": "member1", "studentId": "20260002"},
    {"id": "tu3", "name": "팀원2", "loginId": "member2", "studentId": "20260003"},
    {"id": "tu4", "name": "팀원3", "loginId": "member3", "studentId": "20260004"},
    {"id": "tu5", "name": "팀원4", "loginId": "member4", "studentId": "20260005"},
]
TEST_IDS = {u["id"] for u in TEST_USERS}
TEST_LOGIN_IDS = {u["loginId"]: u for u in TEST_USERS}


def _entry(n: int, day: int, start: float, end: float, kind: str = "class") -> dict:
    return {"id": f"tseed-{n}", "day": day, "start": start, "end": end, "kind": kind}


def test_portion() -> dict:
    """테스트 팀의 예시 상태 (users/accounts/team/timetables/goals/todos)."""
    return {
        "users": [dict(u) for u in TEST_USERS],
        "accounts": [{"userId": u["id"], "password": "1234", "question": "어릴 적 별명은?", "answer": "테스트"} for u in TEST_USERS],
        "team": {"id": TEST_TEAM_ID, "name": "테스트 팀", "leaderId": "tu1", "memberIds": [u["id"] for u in TEST_USERS],
                 "inviteCode": "test01", "inviteDaysLeft": 7},
        "timetables": {
            "tu1": [_entry(1, 0, 9, 12), _entry(2, 2, 13, 15), _entry(3, 4, 10, 12)],
            "tu2": [_entry(4, 0, 13, 15), _entry(5, 1, 9, 12), _entry(6, 3, 14, 16)],
            "tu3": [_entry(7, 1, 13, 15), _entry(8, 2, 9, 11), _entry(9, 4, 13, 15)],
            "tu4": [],
            "tu5": [_entry(10, 0, 15, 17), _entry(11, 3, 9, 11)],
        },
        "goals": [{"id": "tg1", "teamId": TEST_TEAM_ID, "title": "테스트 목표"}],
        "todos": [
            {"id": "ttd1", "goalId": "tg1", "teamId": TEST_TEAM_ID, "title": "화면 둘러보기", "assigneeId": "tu2", "due": "2026-12-05", "status": "doing", "note": ""},
            {"id": "ttd2", "goalId": "tg1", "teamId": TEST_TEAM_ID, "title": "시간표 입력해 보기", "assigneeId": "tu3", "due": "2026-12-05", "status": "doing", "note": ""},
            {"id": "ttd3", "goalId": "tg1", "teamId": TEST_TEAM_ID, "title": "투표 만들어 보기", "assigneeId": "tu1", "due": "2026-12-06", "status": "doing", "note": ""},
        ],
    }


def reset_test(state: dict) -> dict:
    """테스트 계정·팀 부분만 예시로 되돌린다. 다른 사용자·팀은 건드리지 않는다."""
    t = test_portion()
    st = {k: (v if not isinstance(v, (list, dict)) else json.loads(json.dumps(v))) for k, v in state.items()}
    st["users"] = [u for u in st.get("users", []) if u.get("id") not in TEST_IDS] + t["users"]
    st["accounts"] = [a for a in st.get("accounts", []) if a.get("userId") not in TEST_IDS] + t["accounts"]
    removed_teams = {TEST_TEAM_ID}
    teams = []
    for team in st.get("teams", []):
        if team.get("id") == TEST_TEAM_ID or team.get("leaderId") in TEST_IDS:
            removed_teams.add(team.get("id"))
            continue
        team["memberIds"] = [m for m in team.get("memberIds", []) if m not in TEST_IDS]
        teams.append(team)
    st["teams"] = teams + [t["team"]]
    votes = {k: v for k, v in st.get("votes", {}).items() if k not in removed_teams and v is not None}
    for v in votes.values():
        v["ballots"] = {uid: b for uid, b in v.get("ballots", {}).items() if uid not in TEST_IDS}
    st["votes"] = votes
    st["meetings"] = {k: v for k, v in st.get("meetings", {}).items() if k not in removed_teams and v is not None}
    st["goals"] = [g for g in st.get("goals", []) if g.get("teamId") not in removed_teams] + t["goals"]
    st["todos"] = [x for x in st.get("todos", []) if x.get("teamId") not in removed_teams] + t["todos"]
    tt = {k: v for k, v in st.get("timetables", {}).items() if k not in TEST_IDS}
    tt.update(t["timetables"])
    st["timetables"] = tt
    return st


def _read() -> dict:
    try:
        doc = json.loads(STATE_FILE.read_text("utf-8"))
        if isinstance(doc, dict) and "version" in doc:
            return doc
    except (OSError, ValueError):
        pass
    return {"version": 1, "state": None}


def _write(doc: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(doc, ensure_ascii=False), "utf-8")
    tmp.replace(STATE_FILE)


DOC = _read()


def _read_locks() -> dict:
    try:
        return json.loads(LOCK_FILE.read_text("utf-8"))
    except (OSError, ValueError):
        return {}


LOCKS: dict[str, dict] = _read_locks()      # loginId → {"session": str, "lastActive": epoch}


def _save_locks() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    LOCK_FILE.write_text(json.dumps(LOCKS), "utf-8")


def _expire_locks() -> None:
    now = time.time()
    for k in [k for k, v in LOCKS.items() if now - v.get("lastActive", 0) > IDLE_SECONDS]:
        del LOCKS[k]


class LockIn(BaseModel):
    loginId: str
    session: str | None = None


class ResetIn(BaseModel):
    password: str


class StateIn(BaseModel):
    base: int
    state: dict[str, Any]


app = FastAPI(title="Coetus test server", docs_url="/api/docs", openapi_url="/api/openapi.json")


@app.middleware("http")
async def no_cache(request: Request, call_next):
    resp = await call_next(request)
    resp.headers["Cache-Control"] = "no-cache"
    return resp


@app.get("/api/health")
def health():
    return {"ok": True, "version": DOC["version"], "seeded": DOC["state"] is not None}


@app.get("/api/state")
def get_state(since: int = 0):
    with _lock:
        if since and since == DOC["version"]:
            return {"version": DOC["version"], "unchanged": True}
        return {"version": DOC["version"], "state": DOC["state"]}


@app.put("/api/state")
def put_state(body: StateIn):
    with _lock:
        if body.base != DOC["version"]:
            return JSONResponse({"version": DOC["version"], "state": DOC["state"], "conflict": True}, status_code=409)
        state = body.state
        if DOC["state"] is None:
            state = reset_test(state)      # 첫 예시 데이터에 테스트 계정·팀을 덧붙인다
        DOC["version"] += 1
        DOC["state"] = state
        _write(DOC)
        return {"version": DOC["version"], "state": state} if state is not body.state else {"version": DOC["version"]}


# ---------- 테스트 계정 잠금 ----------
@app.get("/api/test-accounts")
def test_accounts():
    """로그인 화면용: 테스트 계정 목록과 지금 누가 쓰고 있는지."""
    with _lock:
        _expire_locks()
        now = time.time()
        out = []
        for u in TEST_USERS:
            lk = LOCKS.get(u["loginId"])
            out.append({"loginId": u["loginId"], "name": u["name"], "busy": lk is not None,
                        "minutesLeft": int((IDLE_SECONDS - (now - lk["lastActive"])) // 60) + 1 if lk else 0})
        return {"accounts": out, "idleMinutes": IDLE_SECONDS // 60}


@app.post("/api/lock/acquire")
def lock_acquire(body: LockIn):
    """테스트 계정이면 잠근다. 다른 사람이 쓰는 중이면 409."""
    if body.loginId not in TEST_LOGIN_IDS:
        return {"test": False}
    with _lock:
        _expire_locks()
        lk = LOCKS.get(body.loginId)
        if lk and lk.get("session") != body.session:
            left = int((IDLE_SECONDS - (time.time() - lk["lastActive"])) // 60) + 1
            return JSONResponse({"test": True, "ok": False, "busy": True, "minutesLeft": left}, status_code=409)
        session = body.session or secrets.token_urlsafe(12)
        LOCKS[body.loginId] = {"session": session, "lastActive": time.time()}
        _save_locks()
        return {"test": True, "ok": True, "session": session, "idleMinutes": IDLE_SECONDS // 60}


@app.post("/api/lock/heartbeat")
def lock_heartbeat(body: LockIn):
    """활동이 있을 때 호출. 내 잠금이 아니면(만료 후 다른 사람이 가져갔으면) 409 → 프런트가 로그아웃한다."""
    with _lock:
        _expire_locks()
        lk = LOCKS.get(body.loginId)
        if not lk or lk.get("session") != body.session:
            return JSONResponse({"ok": False, "lost": True}, status_code=409)
        lk["lastActive"] = time.time()
        _save_locks()
        return {"ok": True}


@app.post("/api/lock/release")
def lock_release(body: LockIn):
    with _lock:
        lk = LOCKS.get(body.loginId)
        if lk and lk.get("session") == body.session:
            del LOCKS[body.loginId]
            _save_locks()
        return {"ok": True}


@app.post("/api/test-reset")
def test_reset(body: ResetIn):
    """암호가 맞으면 테스트 계정·팀만 예시 상태로 되돌리고 잠금을 모두 푼다."""
    if body.password != TEST_RESET_PASSWORD:
        return JSONResponse({"ok": False, "reason": "암호가 달라요"}, status_code=403)
    with _lock:
        if DOC["state"] is None:
            return {"ok": True, "version": DOC["version"], "note": "아직 데이터가 없어요. 접속하면 예시로 시작해요."}
        DOC["version"] += 1
        DOC["state"] = reset_test(DOC["state"])
        _write(DOC)
        for k in list(LOCKS):
            if k in TEST_LOGIN_IDS:
                del LOCKS[k]
        _save_locks()
        return {"ok": True, "version": DOC["version"]}


@app.post("/api/reset")
def reset():
    """(관리용) 문서 전체를 비운다. 다음에 접속한 클라이언트가 예시 데이터를 다시 올린다."""
    with _lock:
        DOC["version"] += 1
        DOC["state"] = None
        _write(DOC)
        return {"version": DOC["version"]}


if DIST_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(DIST_DIR), html=True), name="static")
