"""팀의 공통 가능 시간 (팀원만 볼 수 있음). 경로: api/teams/{teamId}/availability"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import TeamMember, TimetableEntry, User
from ..security import current_user
from ..services.availability import Busy, compute_availability, who_is_free
from .teams import membership

router = APIRouter(prefix="/api/teams", tags=["공통 공강"])


@router.get(
    "/{team_id}/availability",
    summary="팀의 공통 가능 시간. 시간표를 입력한 팀원 기준으로 계산하고, 입력 안 한 팀원은 notEntered 로 알려줌",
)
def team_availability(team_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    team, _ = membership(db, team_id, user)
    rows = db.execute(
        select(User.id, User.name).join(TeamMember, TeamMember.user_id == User.id).where(TeamMember.team_id == team.id).order_by(TeamMember.joined_at, TeamMember.id)
    ).all()
    busy_by_user: dict[int, list[Busy]] = {uid: [] for uid, _ in rows}
    for e in db.scalars(select(TimetableEntry).where(TimetableEntry.user_id.in_(busy_by_user))):
        busy_by_user[e.user_id].append(Busy(e.day, e.start_min / 60, e.end_min / 60))

    entered = [(name, busy_by_user[uid]) for uid, name in rows if busy_by_user[uid]]
    not_entered = [name for uid, name in rows if not busy_by_user[uid]]

    result = compute_availability([entries for _, entries in entered])
    start_h = settings.availability_start_hour
    # 칸을 누르면 "누가 가능/바쁜지" 보여주는 화면용 (프론트 membersAt). 시간표를 입력한 팀원만 센다.
    for d in result["days"]:
        who = [who_is_free(entered, d["day"], start_h + s / 2) for s in range(len(d["slots"]))]
        d["free"] = [f for f, _ in who]
        d["busy"] = [b for _, b in who]
    return {
        **result,
        "entered": len(entered),
        "notEntered": not_entered,
        "windowStart": start_h,
        "windowEnd": settings.availability_end_hour,
    }
