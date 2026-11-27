"""API 오류 형식.  { "code": "영문_코드", "message": "화면에 보여줄 한글 안내" }
프론트는 code 로 분기하고 message 는 그대로 보여주면 된다."""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, **extra):
        self.status, self.code, self.message, self.extra = status, code, message, extra


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, e: ApiError):
        return JSONResponse({"code": e.code, "message": e.message, **e.extra}, status_code=e.status)


def install_validation_handler(app: FastAPI) -> None:
    from fastapi.exceptions import RequestValidationError

    @app.exception_handler(RequestValidationError)
    async def _invalid(_: Request, e: RequestValidationError):
        # 형식이 아예 다른 요청(필드 누락 등)도 같은 모양으로 돌려준다
        return JSONResponse({"code": "invalid_input", "message": "입력값을 확인해 주세요."}, status_code=422)
