"""내 시간표 (바쁜 시간만 입력). 경로는 api/timetable...

응답의 시간은 프론트 types.ts 처럼 '시 단위 소수'(9.5 = 9시 30분)다. DB 에는 분으로 저장한다.
"""
from typing import Literal

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..errors import ApiError
from ..models import TimetableEntry, User
from ..security import current_user

router = APIRouter(prefix="/api/timetable", tags=["시간표"])


class EntryIn(BaseModel):
    day: int  # 0=월 … 6=일
    start: float  # 9.5 = 9시 30분
    end: float
    kind: Literal["class", "blocked"]  # 수업 / 활동 불가


class EntryOut(BaseModel):
    id: str
    day: int
    start: float
    end: float
    kind: str


def entry_out(e: TimetableEntry) -> EntryOut:
    return EntryOut(id=str(e.id), day=e.day, start=e.start_min / 60, end=e.end_min / 60, kind=e.kind)


def to_minutes(hours: float) -> int:
    """시 단위 소수를 분으로 바꾼다. 하루 안(0~24시)이고 30분 단위가 아니면 오류."""
    minutes = round(hours * 60)
    if abs(minutes - hours * 60) > 1e-6 or minutes % settings.timetable_slot_minutes or not 0 <= minutes <= 24 * 60:
        raise ApiError(400, "invalid_time", f"시간은 {settings.timetable_slot_minutes}분 단위로, 0시~24시 안에서 입력해 주세요.")
    return minutes


@router.get("", summary="내 시간표")
def list_entries(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[EntryOut]:
    rows = db.scalars(select(TimetableEntry).where(TimetableEntry.user_id == user.id).order_by(TimetableEntry.day, TimetableEntry.start_min))
    return [entry_out(e) for e in rows]


@router.post(
    "",
    summary="시간 추가. 종료가 시작보다 빠르면 400(invalid_order), 같은 요일에 겹치면 409(overlap + conflict)",
    status_code=201,
)
def add_entry(body: EntryIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> EntryOut:
    if body.day not in range(7):
        raise ApiError(400, "invalid_day", "요일은 0(월)~6(일)로 보내 주세요.")
    start, end = to_minutes(body.start), to_minutes(body.end)
    if end <= start:
        raise ApiError(400, "invalid_order", "종료 시간은 시작 시간보다 늦어야 해요.")
    conflict = db.scalar(
        select(TimetableEntry).where(
            TimetableEntry.user_id == user.id, TimetableEntry.day == body.day, TimetableEntry.start_min < end, start < TimetableEntry.end_min
        )
    )
    if conflict:
        raise ApiError(409, "overlap", "같은 요일에 겹치는 일정이 있어요.", conflict=entry_out(conflict).model_dump())
    entry = TimetableEntry(user_id=user.id, day=body.day, start_min=start, end_min=end, kind=body.kind)
    db.add(entry)
    db.commit()
    return entry_out(entry)


@router.delete("/{entry_id}", summary="시간 삭제 (내 것만)", status_code=204)
def delete_entry(entry_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    entry = db.get(TimetableEntry, int(entry_id)) if entry_id.isdigit() else None
    if not entry or entry.user_id != user.id:  # 남의 것은 있는지도 알려주지 않는다
        raise ApiError(404, "not_found", "해당 일정을 찾을 수 없어요.")
    db.delete(entry)
    db.commit()
    return Response(status_code=204)
