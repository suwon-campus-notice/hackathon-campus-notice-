"""Coetus 테스트 서버 — 여러 기기가 같은 팀 데이터를 보게 하는 최소 백엔드.

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
import threading
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parents[1]           # backend/
DATA_DIR = ROOT / "data"
STATE_FILE = DATA_DIR / "state.json"
DIST_DIR = ROOT.parent / "frontend" / "dist"

_lock = threading.Lock()


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
        DOC["version"] += 1
        DOC["state"] = body.state
        _write(DOC)
        return {"version": DOC["version"]}


@app.post("/api/reset")
def reset():
    """문서를 비운다. 다음에 접속한 클라이언트가 예시 데이터를 다시 올린다."""
    with _lock:
        DOC["version"] += 1
        DOC["state"] = None
        _write(DOC)
        return {"version": DOC["version"]}


if DIST_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(DIST_DIR), html=True), name="static")
