"""서버 시작점.

- /api/...        : API (상대 경로 api/... 로 호출)
- /docs           : 자동 API 문서
- 그 밖의 모든 주소 : frontend/dist (npm run build 결과) 를 그대로 제공. 없으면 안내 페이지.

주의: 공개 주소는 /<아이디>/ 가 붙어서 오지만, 앱에는 / 로 전달된다.
그래서 이 파일의 링크·리다이렉트는 모두 상대 경로를 쓰고, 자동 슬래시 리다이렉트는 끈다.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import FileResponse, HTMLResponse, Response

from .config import settings
from .db import init_db
from .errors import install_error_handlers, install_validation_handler
from .routers import auth, availability, schedule, teams, timetable, todos


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()  # 표가 없으면 만든다 (이미 있으면 그대로 둔다)
    yield


app = FastAPI(
    lifespan=lifespan,
    title="Coetus API",
    description="팀플 일정 조율 및 협업 관리 서비스 백엔드",
    docs_url=None,  # 아래에서 상대 경로 버전으로 직접 만든다
    redoc_url=None,
    openapi_url="/openapi.json",
    # Swagger 의 "Try it out" 이 /<아이디>/ 아래로 요청하도록 상대 경로 지정
    servers=[{"url": "./"}],
)
# "/api/x/" 로 자동 이동시키면 /<아이디>/ 가 빠진 절대 경로가 되어 깨진다
app.router.redirect_slashes = False
install_error_handlers(app)
install_validation_handler(app)
app.include_router(auth.router)
app.include_router(teams.router)
app.include_router(timetable.router)
app.include_router(availability.router)
app.include_router(schedule.router)
app.include_router(todos.router)


@app.get("/api/health", tags=["상태"], summary="서버 상태 확인")
def health():
    return {"ok": True}


@app.get("/docs", include_in_schema=False)
def docs():
    # openapi.json 을 상대 경로로 부른다 → /<아이디>/docs 에서도 /<아이디>/openapi.json 을 찾는다
    return get_swagger_ui_html(openapi_url="openapi.json", title="Coetus API 문서", swagger_ui_parameters={"persistAuthorization": True})


GUIDE_HTML = """<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Coetus 서버</title>
<style>body{font-family:system-ui,sans-serif;max-width:560px;margin:12vh auto;padding:0 20px;line-height:1.6;color:#222}
code{background:#eee;padding:2px 6px;border-radius:4px}</style></head><body>
<h1>Coetus 서버가 동작 중입니다</h1>
<p>아직 화면 파일(<code>frontend/dist</code>)이 없어서 안내 페이지를 보여드려요.</p>
<ol><li><a href="docs">API 문서 보기</a></li>
<li>화면을 보려면 <code>cd frontend &amp;&amp; npm install &amp;&amp; npm run build</code> 를 하고 서버를 다시 시작하세요.</li></ol>
</body></html>"""


@app.get("/{path:path}", include_in_schema=False)
def frontend(path: str):
    """빌드된 화면 파일 제공. 없는 /api/... 주소는 404 로 둔다."""
    if path.startswith("api/"):
        return Response(status_code=404)
    dist = settings.frontend_dist.resolve()
    index = dist / "index.html"
    if not index.is_file():
        return HTMLResponse(GUIDE_HTML)
    target = (dist / path).resolve()
    # dist 밖의 파일은 절대 내보내지 않는다 (../ 방지)
    if path and target.is_file() and dist in target.parents:
        return FileResponse(target)
    return FileResponse(index)
