"""회의 시간 투표와 확정된 회의 (2차). 경로는 api/teams/{id}/schedule, vote, meeting...

모든 동작의 응답은 같은 모양(ScheduleOut)이다: 지금의 투표(없으면 null)와 확정된 회의(없으면 null).
그래서 화면은 동작 뒤에 응답을 그대로 상태에 넣으면 된다.
시간은 프론트 types.ts 처럼 '시 단위 소수'(15 = 15:00)로 주고받고, DB 에는 분으로 저장한다.
"""
import math
from contextlib import contextmanager
from datetime import timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import StaleDataError

from ..config import settings
from ..db import get_db, utcnow
from ..errors import ApiError
from ..models import Ballot, Meeting, TeamMember, User, Vote, VoteOption
from ..security import current_user
from ..services import vote as rules
from .teams import LEADER, leader_only, membership
from .timetable import to_minutes

router = APIRouter(prefix="/api/teams/{team_id}", tags=["일정(투표·회의)"])


# ── 요청·응답 모양 (필드 이름은 프론트 types.ts 의 Vote / Meeting 과 같다) ──

class OptionIn(BaseModel):
    day: int  # 0=월 … 6=일
    start: float  # 15 = 15:00 (회의 시작 시각)


class CreateVoteIn(BaseModel):
    options: list[OptionIn]


class BallotIn(BaseModel):
    optionIds: list[str]


class MeetingIn(BaseModel):
    day: int
    start: float


class OptionOut(BaseModel):
    id: str
    day: int
    start: float


class VoteOut(BaseModel):
    id: str
    teamId: str
    createdBy: str
    options: list[OptionOut]
    ballots: dict[str, list[str]]  # 사용자 id → 고른 후보 id 목록 (팀원은 서로의 표를 볼 수 있다)
    hoursLeft: int  # 마감까지 남은 시간(올림). 0 이면 마감
    revote: bool
    ended: bool  # 마감 시각이 지났는지 (과반을 못 넘기고 끝난 투표)


class MeetingOut(BaseModel):
    teamId: str
    day: int
    start: float
    votes: int  # 확정 당시 득표 수


class ScheduleOut(BaseModel):
    vote: VoteOut | None
    meeting: MeetingOut | None


# ── 도우미 ──

def find_vote(db: Session, team_id: int) -> Vote | None:
    return db.scalar(select(Vote).where(Vote.team_id == team_id))


def find_meeting(db: Session, team_id: int) -> Meeting | None:
    return db.scalar(select(Meeting).where(Meeting.team_id == team_id))


def is_ended(vote: Vote) -> bool:
    return utcnow() >= vote.deadline


def new_deadline():
    return utcnow() + timedelta(hours=settings.vote_hours)


def ballots_of(db: Session, vote_id: int) -> dict[int, set[int]]:
    result: dict[int, set[int]] = {}
    for b in db.scalars(select(Ballot).where(Ballot.vote_id == vote_id)):
        result.setdefault(b.user_id, set()).add(b.option_id)
    return result


def options_of(db: Session, vote_id: int) -> list[VoteOption]:
    return list(db.scalars(select(VoteOption).where(VoteOption.vote_id == vote_id).order_by(VoteOption.id)))


def team_size(db: Session, team_id: int) -> int:
    return db.scalar(select(func.count()).select_from(TeamMember).where(TeamMember.team_id == team_id)) or 0


def vote_out(db: Session, vote: Vote) -> VoteOut:
    seconds = (vote.deadline - utcnow()).total_seconds()
    ballots = ballots_of(db, vote.id)
    return VoteOut(
        id=str(vote.id),
        teamId=str(vote.team_id),
        createdBy=str(vote.created_by),
        options=[OptionOut(id=str(o.id), day=o.day, start=o.start_min / 60) for o in options_of(db, vote.id)],
        ballots={str(u): sorted(str(o) for o in picked) for u, picked in ballots.items()},
        hoursLeft=max(0, math.ceil(seconds / 3600)),
        revote=vote.revote,
        ended=is_ended(vote),
    )


def schedule_out(db: Session, team_id: int) -> ScheduleOut:
    vote, meeting = find_vote(db, team_id), find_meeting(db, team_id)
    return ScheduleOut(
        vote=vote_out(db, vote) if vote else None,
        meeting=MeetingOut(teamId=str(team_id), day=meeting.day, start=meeting.start_min / 60, votes=meeting.votes) if meeting else None,
    )


def check_slot(day: int, start: float) -> int:
    """요일과 시작 시각을 검사하고 분으로 돌려준다 (하루 안, 30분 단위)."""
    if day not in range(7):
        raise ApiError(400, "invalid_day", "요일은 0(월)~6(일)이어야 해요.")
    minutes = to_minutes(start)
    if minutes >= 24 * 60:
        raise ApiError(400, "invalid_time", "시작 시각은 24시 전이어야 해요.")
    return minutes


@contextmanager
def guard(db: Session):
    """다른 사람이 같은 순간에 투표를 확정·취소해서 지워졌을 때(표를 쓰려는데 투표가 없어짐 등)
    서버 오류(500) 대신 알아볼 수 있는 안내(409)를 돌려준다. 화면은 이 오류를 받으면 최신 상태를 다시 불러온다."""
    try:
        yield
    except (IntegrityError, StaleDataError):
        db.rollback()
        raise ApiError(409, "vote_changed", "투표가 방금 바뀌었어요. 최신 상태를 다시 확인해 주세요.")


def need_vote(db: Session, team_id: int) -> Vote:
    vote = find_vote(db, team_id)
    if not vote:
        raise ApiError(404, "vote_not_found", "진행 중인 투표가 없어요.")
    return vote


def confirm(db: Session, vote: Vote, option: VoteOption, votes: int) -> None:
    """후보 하나로 회의를 확정하고 투표를 닫는다 (이전에 확정된 회의는 바뀐다)."""
    db.execute(delete(Meeting).where(Meeting.team_id == vote.team_id))
    db.add(Meeting(team_id=vote.team_id, day=option.day, start_min=option.start_min, votes=votes))
    db.delete(vote)  # 후보·표도 함께 지워진다 (CASCADE)


# ── API ──

@router.get("/schedule", summary="일정 탭: 지금의 투표와 확정된 회의 (팀원만)")
def get_schedule(team_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> ScheduleOut:
    team, _ = membership(db, team_id, user)
    return schedule_out(db, team.id)


@router.post(
    "/vote",
    summary="투표 만들기 (팀원 누구나). 진행 중인 투표가 있으면 409(vote_exists). 확정된 회의가 있으면 새 투표가 만들어지며 사라짐",
    status_code=201,
)
def create_vote(team_id: str, body: CreateVoteIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> ScheduleOut:
    team, _ = membership(db, team_id, user)
    if not 1 <= len(body.options) <= settings.vote_max_options:
        raise ApiError(400, "invalid_options", f"후보는 1~{settings.vote_max_options}개로 만들어 주세요.")
    slots = [(o.day, check_slot(o.day, o.start)) for o in body.options]
    if len(set(slots)) != len(slots):
        raise ApiError(400, "duplicate_option", "같은 시간이 두 번 들어 있어요.")
    if find_vote(db, team.id):
        raise ApiError(409, "vote_exists", "이미 진행 중인 투표가 있어요.")
    vote = Vote(team_id=team.id, created_by=user.id, deadline=new_deadline(), revote=False)
    db.add(vote)
    try:
        db.flush()
    except IntegrityError:  # 동시에 두 명이 만들었을 때
        db.rollback()
        raise ApiError(409, "vote_exists", "이미 진행 중인 투표가 있어요.")
    for day, minutes in slots:
        db.add(VoteOption(vote_id=vote.id, day=day, start_min=minutes))
    db.execute(delete(Meeting).where(Meeting.team_id == team.id))
    db.commit()
    return schedule_out(db, team.id)


@router.put(
    "/vote/ballot",
    summary="내 표 저장(처음 투표·수정). 과반이면 회의가 확정되고, 최다표가 같으면 그 후보들끼리 재투표(표 초기화)가 시작됨. 마감 뒤에는 409(vote_ended)",
)
def cast_ballot(team_id: str, body: BallotIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> ScheduleOut:
    team, _ = membership(db, team_id, user)
    vote = need_vote(db, team.id)
    if is_ended(vote):
        raise ApiError(409, "vote_ended", "투표가 이미 끝났어요.")
    options = options_of(db, vote.id)
    try:
        picked = {int(i) for i in body.optionIds}
    except ValueError:
        picked = set()
    if not picked or not picked <= {o.id for o in options}:
        raise ApiError(400, "invalid_option", "투표할 시간을 하나 이상 골라 주세요.")
    with guard(db):
        db.execute(delete(Ballot).where(Ballot.vote_id == vote.id, Ballot.user_id == user.id))
        for o in picked:
            db.add(Ballot(vote_id=vote.id, user_id=user.id, option_id=o))
        db.flush()

        option_ids = [o.id for o in options]
        decision = rules.decide(option_ids, ballots_of(db, vote.id), team_size(db, team.id))
        if decision.kind == "confirmed":
            confirm(db, vote, next(o for o in options if o.id == decision.option_id), decision.votes)
        elif decision.kind == "tie":
            db.execute(delete(VoteOption).where(VoteOption.vote_id == vote.id, VoteOption.id.not_in(decision.option_ids)))
            db.execute(delete(Ballot).where(Ballot.vote_id == vote.id))
            vote.revote = True
            vote.deadline = new_deadline()
        db.commit()
    return schedule_out(db, team.id)


@router.delete("/vote", summary="진행 중인 투표 취소 (만든 사람이나 팀장). 받은 표가 모두 사라짐")
def cancel_vote(team_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> ScheduleOut:
    team, me = membership(db, team_id, user)
    vote = need_vote(db, team.id)
    if vote.created_by != user.id and me.role != LEADER:
        raise ApiError(403, "not_allowed", "투표를 만든 사람이나 팀장만 취소할 수 있어요.")
    with guard(db):
        db.delete(vote)
        db.commit()
    return schedule_out(db, team.id)


@router.post("/vote/confirm", summary="마감된 투표를 단독 최다표 후보로 확정 (팀장만). 동률이거나 표가 없으면 409(no_single_top)")
def confirm_ended(team_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> ScheduleOut:
    team = leader_only(db, team_id, user)
    vote = need_vote(db, team.id)
    if not is_ended(vote):
        raise ApiError(409, "vote_not_ended", "아직 투표가 끝나지 않았어요.")
    options = options_of(db, vote.id)
    ballots = ballots_of(db, vote.id)
    top = rules.single_top([o.id for o in options], ballots)
    if top is None:
        raise ApiError(409, "no_single_top", "가장 많이 고른 시간이 하나로 정해지지 않아요. 다시 투표해 주세요.")
    with guard(db):
        confirm(db, vote, next(o for o in options if o.id == top), rules.tally([o.id for o in options], ballots)[top])
        db.commit()
    return schedule_out(db, team.id)


@router.post("/vote/restart", summary="마감된 투표를 닫고 새로 시작할 수 있게 함 (팀장만)")
def restart_vote(team_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> ScheduleOut:
    team = leader_only(db, team_id, user)
    vote = need_vote(db, team.id)
    if not is_ended(vote):
        raise ApiError(409, "vote_not_ended", "아직 투표가 끝나지 않았어요.")
    with guard(db):
        db.delete(vote)
        db.commit()
    return schedule_out(db, team.id)


@router.post("/vote/end", summary="(시연용) 마감 시각을 지금으로 당겨 24시간이 지난 것으로 만듦 (팀장만)")
def end_vote(team_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> ScheduleOut:
    team = leader_only(db, team_id, user)
    vote = need_vote(db, team.id)
    vote.deadline = utcnow()
    db.commit()
    return schedule_out(db, team.id)


@router.put("/meeting", summary="확정된 회의 시간 변경 (팀장만). 확정된 회의가 없으면 404(meeting_not_found)")
def change_meeting(team_id: str, body: MeetingIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> ScheduleOut:
    team = leader_only(db, team_id, user)
    meeting = find_meeting(db, team.id)
    if not meeting:
        raise ApiError(404, "meeting_not_found", "확정된 회의가 없어요.")
    meeting.start_min = check_slot(body.day, body.start)
    meeting.day = body.day
    db.commit()
    return schedule_out(db, team.id)
