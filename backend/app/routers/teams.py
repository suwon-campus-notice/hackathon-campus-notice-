"""팀: 만들기, 초대 링크, 참여, 팀장 넘기기, 탈퇴.

팀장 전용 기능은 화면이 아니라 여기(서버)에서 검사한다.
"""
import math
import secrets
from datetime import timedelta

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db, utcnow
from ..errors import ApiError
from ..models import Ballot, Invite, Team, TeamMember, User, Vote
from ..security import current_user

LEADER, MEMBER = "leader", "member"

router = APIRouter(prefix="/api", tags=["팀"])


# ── 응답 모양 (필드 이름은 프론트 types.ts 의 Team 과 같다. members 는 이름 표시용으로 덧붙임) ──

class MemberOut(BaseModel):
    id: str
    name: str


class TeamOut(BaseModel):
    id: str
    name: str
    leaderId: str
    memberIds: list[str]
    inviteCode: str
    inviteDaysLeft: int  # 0 이하면 만료
    members: list[MemberOut]


class InvitePreviewOut(BaseModel):
    team: TeamOut
    expired: bool


class CreateTeamIn(BaseModel):
    name: str


class TransferIn(BaseModel):
    userId: str


# ── 도우미 ──

def parse_id(value: str) -> int:
    try:
        return int(value)
    except ValueError:
        raise ApiError(404, "team_not_found", "팀을 찾을 수 없어요.")


def new_token() -> str:
    return secrets.token_urlsafe(9)  # 추측하기 어려운 랜덤 값


def days_left(invite: Invite) -> int:
    seconds = (invite.expires_at - utcnow()).total_seconds()
    return max(0, math.ceil(seconds / 86400))


def team_out(db: Session, team: Team) -> TeamOut:
    rows = db.execute(
        select(TeamMember, User).join(User, User.id == TeamMember.user_id).where(TeamMember.team_id == team.id).order_by(TeamMember.joined_at, TeamMember.id)
    ).all()
    invite = db.scalar(select(Invite).where(Invite.team_id == team.id))
    leader = next(m.user_id for m, _ in rows if m.role == LEADER)
    return TeamOut(
        id=str(team.id),
        name=team.name,
        leaderId=str(leader),
        memberIds=[str(m.user_id) for m, _ in rows],
        inviteCode=invite.token,
        inviteDaysLeft=days_left(invite),
        members=[MemberOut(id=str(u.id), name=u.name) for _, u in rows],
    )


def membership(db: Session, team_id: str, user: User) -> tuple[Team, TeamMember]:
    """내가 속한 팀이어야 한다. 팀이 없거나 내 팀이 아니면 똑같이 404 (팀 존재 여부를 알려주지 않는다)."""
    team = db.get(Team, parse_id(team_id))
    me = team and db.scalar(select(TeamMember).where(TeamMember.team_id == team.id, TeamMember.user_id == user.id))
    if not team or not me:
        raise ApiError(404, "team_not_found", "팀을 찾을 수 없어요.")
    return team, me


def leader_only(db: Session, team_id: str, user: User) -> Team:
    team, me = membership(db, team_id, user)
    if me.role != LEADER:
        raise ApiError(403, "leader_only", "팀장만 할 수 있어요.")
    return team


# ── API ──

@router.get("/teams", summary="내 팀 목록")
def my_teams(user: User = Depends(current_user), db: Session = Depends(get_db)) -> list[TeamOut]:
    teams = db.scalars(select(Team).join(TeamMember, TeamMember.team_id == Team.id).where(TeamMember.user_id == user.id).order_by(TeamMember.joined_at, Team.id))
    return [team_out(db, t) for t in teams]


@router.post("/teams", summary="팀 만들기 (만든 사람이 팀장, 초대 링크가 함께 만들어짐)", status_code=201)
def create_team(body: CreateTeamIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> TeamOut:
    name = body.name.strip()
    if not name or len(name) > 100:
        raise ApiError(400, "invalid_input", "팀 이름을 입력해 주세요.")
    team = Team(name=name)
    db.add(team)
    db.flush()
    db.add(TeamMember(team_id=team.id, user_id=user.id, role=LEADER))
    db.add(Invite(team_id=team.id, token=new_token(), expires_at=utcnow() + timedelta(days=settings.invite_expire_days)))
    db.commit()
    return team_out(db, team)


@router.get("/teams/{team_id}", summary="팀 정보 (팀원만)")
def get_team(team_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> TeamOut:
    team, _ = membership(db, team_id, user)
    return team_out(db, team)


@router.get("/invites/{code}", summary="초대 링크 확인 (참여 전 팀 소개 + 만료 여부)")
def invite_preview(code: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> InvitePreviewOut:
    invite = db.scalar(select(Invite).where(Invite.token == code))
    if not invite:  # 없는 코드이거나, 새 링크가 만들어져 무효가 된 코드
        raise ApiError(404, "invite_not_found", "초대 링크를 찾을 수 없어요.")
    return InvitePreviewOut(team=team_out(db, db.get(Team, invite.team_id)), expired=days_left(invite) <= 0)


@router.post("/invites/{code}/join", summary="초대 링크로 팀 참여 (이미 팀원이면 그대로 팀 정보를 돌려줌)")
def join_team(code: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> TeamOut:
    invite = db.scalar(select(Invite).where(Invite.token == code))
    if not invite:
        raise ApiError(404, "invite_not_found", "초대 링크를 찾을 수 없어요.")
    team = db.get(Team, invite.team_id)
    already = db.scalar(select(TeamMember).where(TeamMember.team_id == team.id, TeamMember.user_id == user.id))
    if not already:
        if days_left(invite) <= 0:
            raise ApiError(410, "invite_expired", "만료된 초대 링크예요. 팀장에게 새 링크를 요청해 주세요.")
        db.add(TeamMember(team_id=team.id, user_id=user.id, role=MEMBER))
        db.commit()
    return team_out(db, team)


@router.post("/teams/{team_id}/invite/renew", summary="새 초대 링크 만들기 (팀장만, 옛 링크는 바로 무효)")
def renew_invite(team_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> TeamOut:
    team = leader_only(db, team_id, user)
    invite = db.scalar(select(Invite).where(Invite.team_id == team.id))
    invite.token = new_token()
    invite.expires_at = utcnow() + timedelta(days=settings.invite_expire_days)
    db.commit()
    return team_out(db, team)


@router.post("/teams/{team_id}/leader", summary="팀장 넘기기 (팀장만)")
def transfer_leader(team_id: str, body: TransferIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> TeamOut:
    team = leader_only(db, team_id, user)
    try:
        target_id = int(body.userId)
    except ValueError:
        target_id = -1
    target = db.scalar(select(TeamMember).where(TeamMember.team_id == team.id, TeamMember.user_id == target_id))
    if not target or target_id == user.id:
        raise ApiError(400, "invalid_target", "다른 팀원을 골라 주세요.")
    db.scalar(select(TeamMember).where(TeamMember.team_id == team.id, TeamMember.user_id == user.id)).role = MEMBER
    target.role = LEADER
    db.commit()
    return team_out(db, team)


@router.post("/teams/{team_id}/leave", summary="팀 탈퇴 (팀장은 먼저 넘겨야 함. 팀장 혼자인 팀이면 팀이 삭제됨)", status_code=204)
def leave_team(team_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    team, me = membership(db, team_id, user)
    if me.role == LEADER:
        count = len(db.scalars(select(TeamMember).where(TeamMember.team_id == team.id)).all())
        if count > 1:
            raise ApiError(409, "leader_must_transfer", "팀장은 팀장을 먼저 넘겨야 탈퇴할 수 있어요.")
        db.delete(team)  # 팀원·초대 링크도 함께 지워진다 (CASCADE)
    else:
        # (임의) 탈퇴하면 이 팀 투표에 낸 내 표는 지운다. 맡은 할 일은 그대로 두고 팀장이 담당자를 바꾼다.
        vote = db.scalar(select(Vote).where(Vote.team_id == team.id))
        if vote:
            db.execute(delete(Ballot).where(Ballot.vote_id == vote.id, Ballot.user_id == user.id))
        db.delete(me)
    db.commit()
    return Response(status_code=204)
