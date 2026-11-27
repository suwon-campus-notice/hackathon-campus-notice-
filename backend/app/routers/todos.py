"""목표와 할 일 (2차). 경로는 api/teams/{id}/todos, goals...

- 목표(Goal)는 팀장이 만들고, 목표 안에 개인 목표(Todo, 할 일)를 담는다.
- 할 일의 상태: 진행 중(doing) → 완료 요청(requested) → 확인 완료(done)
- 공개 범위는 서버가 지킨다: 팀장은 팀의 모든 할 일을, 팀원은 자기 할 일만 받는다.
모든 동작의 응답은 같은 모양(TodosOut)이다: 내가 볼 수 있는 목표와 할 일 전체.
"""
import re
from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..errors import ApiError
from ..models import Goal, TeamMember, Todo, User
from ..security import current_user
from .teams import LEADER, leader_only, membership

router = APIRouter(prefix="/api/teams/{team_id}", tags=["목표·할 일"])

DOING, REQUESTED, DONE = "doing", "requested", "done"
TITLE_MAX = 200
NOTE_MAX = 5000


# ── 요청·응답 모양 (필드 이름은 프론트 types.ts 의 Goal / Todo 와 같다) ──

class TodoDraftIn(BaseModel):
    id: str | None = None  # 이미 있는 할 일이면 그 id (수정), 없으면 새로 추가
    title: str
    assigneeId: str
    due: str  # YYYY-MM-DD


class GoalIn(BaseModel):
    title: str
    todos: list[TodoDraftIn]


class NoteIn(BaseModel):
    note: str


class GoalOut(BaseModel):
    id: str
    teamId: str
    title: str


class TodoOut(BaseModel):
    id: str
    goalId: str
    teamId: str
    title: str
    assigneeId: str
    due: str
    status: str
    note: str


class TodosOut(BaseModel):
    goals: list[GoalOut]
    todos: list[TodoOut]


class GoalCreatedOut(TodosOut):
    goalId: str


# ── 도우미 ──

def goal_out(g: Goal) -> GoalOut:
    return GoalOut(id=str(g.id), teamId=str(g.team_id), title=g.title)


def todo_out(t: Todo) -> TodoOut:
    return TodoOut(id=str(t.id), goalId=str(t.goal_id), teamId=str(t.team_id), title=t.title, assigneeId=str(t.assignee_id), due=t.due, status=t.status, note=t.note)


def todos_out(db: Session, team_id: int, user: User, is_leader: bool) -> TodosOut:
    goals = db.scalars(select(Goal).where(Goal.team_id == team_id).order_by(Goal.id))
    query = select(Todo).where(Todo.team_id == team_id).order_by(Todo.id)
    if not is_leader:
        query = query.where(Todo.assignee_id == user.id)  # 팀원은 자기 할 일만
    return TodosOut(goals=[goal_out(g) for g in goals], todos=[todo_out(t) for t in db.scalars(query)])


def parse_id(value: str | None, code: str, message: str) -> int:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        raise ApiError(404, code, message)


def clean_title(value: str, message: str) -> str:
    title = value.strip()
    if not title or len(title) > TITLE_MAX:
        raise ApiError(400, "invalid_input", message)
    return title


def check_draft(db: Session, team_id: int, d: TodoDraftIn) -> tuple[str, int, str]:
    """할 일 한 개의 입력을 검사한다: (제목, 담당자 id, 마감일)"""
    title = clean_title(d.title, "할 일 제목을 입력해 주세요.")
    try:
        assignee = int(d.assigneeId)
    except ValueError:
        assignee = -1
    if not db.scalar(select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.user_id == assignee)):
        raise ApiError(400, "invalid_assignee", "담당자는 팀원 중에서 골라 주세요.")
    try:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", d.due):
            raise ValueError
        date.fromisoformat(d.due)
    except ValueError:
        raise ApiError(400, "invalid_due", "마감일은 YYYY-MM-DD 형식의 올바른 날짜여야 해요.")
    return title, assignee, d.due


def find_goal(db: Session, team_id: int, goal_id: str) -> Goal:
    goal = db.get(Goal, parse_id(goal_id, "goal_not_found", "목표를 찾을 수 없어요."))
    if not goal or goal.team_id != team_id:
        raise ApiError(404, "goal_not_found", "목표를 찾을 수 없어요.")
    return goal


def find_todo(db: Session, team_id: int, todo_id: str, user: User, is_leader: bool) -> Todo:
    """담당자 본인이나 팀장만 열 수 있다. 그 밖에는 있는지 여부도 알려주지 않고 404."""
    todo = db.get(Todo, parse_id(todo_id, "todo_not_found", "할 일을 찾을 수 없어요."))
    if not todo or todo.team_id != team_id or not (is_leader or todo.assignee_id == user.id):
        raise ApiError(404, "todo_not_found", "할 일을 찾을 수 없어요.")
    return todo


def check_todo_count(count: int) -> None:
    if count > settings.goal_max_todos:
        raise ApiError(400, "too_many_todos", f"한 목표에는 할 일을 {settings.goal_max_todos}개까지 담을 수 있어요.")


# ── 목표 ──

@router.get("/todos", summary="목표와 할 일 목록 (팀원만). 팀장은 전체, 팀원은 자기 할 일만")
def list_todos(team_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> TodosOut:
    team, me = membership(db, team_id, user)
    return todos_out(db, team.id, user, me.role == LEADER)


@router.post("/goals", summary="목표와 할 일을 함께 만들기 (팀장만). 할 일은 '진행 중'으로 시작", status_code=201)
def create_goal(team_id: str, body: GoalIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> GoalCreatedOut:
    team = leader_only(db, team_id, user)
    title = clean_title(body.title, "큰 목표를 입력해 주세요.")
    check_todo_count(len(body.todos))
    drafts = [check_draft(db, team.id, d) for d in body.todos]
    goal = Goal(team_id=team.id, title=title)
    db.add(goal)
    db.flush()
    for t, assignee, due in drafts:
        db.add(Todo(goal_id=goal.id, team_id=team.id, title=t, assignee_id=assignee, due=due, status=DOING, note=""))
    db.commit()
    return GoalCreatedOut(goalId=str(goal.id), **todos_out(db, team.id, user, True).model_dump())


@router.put("/goals/{goal_id}", summary="목표 이름과 할 일 고치기 (팀장만). 보내지 않은 기존 할 일은 삭제, id 없는 항목은 새로 추가")
def update_goal(team_id: str, goal_id: str, body: GoalIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> TodosOut:
    team = leader_only(db, team_id, user)
    goal = find_goal(db, team.id, goal_id)
    goal.title = clean_title(body.title, "큰 목표를 입력해 주세요.")
    check_todo_count(len(body.todos))
    existing = {t.id: t for t in db.scalars(select(Todo).where(Todo.goal_id == goal.id))}
    keep: set[int] = set()
    for d in body.todos:
        title, assignee, due = check_draft(db, team.id, d)
        if d.id is None:
            db.add(Todo(goal_id=goal.id, team_id=team.id, title=title, assignee_id=assignee, due=due, status=DOING, note=""))
            continue
        todo = existing.get(parse_id(d.id, "invalid_input", "할 일 번호가 올바르지 않아요."))
        if not todo:
            raise ApiError(400, "invalid_input", "이 목표에 없는 할 일이에요.")
        todo.title, todo.assignee_id, todo.due = title, assignee, due
        keep.add(todo.id)
    for tid, todo in existing.items():
        if tid not in keep:
            db.delete(todo)
    db.commit()
    return todos_out(db, team.id, user, True)


@router.delete("/goals/{goal_id}", summary="목표 삭제 (팀장만). 안의 할 일도 함께 삭제")
def delete_goal(team_id: str, goal_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> TodosOut:
    team = leader_only(db, team_id, user)
    goal = find_goal(db, team.id, goal_id)
    db.execute(delete(Todo).where(Todo.goal_id == goal.id))
    db.delete(goal)
    db.commit()
    return todos_out(db, team.id, user, True)


# ── 할 일 ──

@router.post("/todos/{todo_id}/request", summary="완료 요청: 수행 내용을 적고 '완료 요청'으로 (담당자만, 진행 중일 때)")
def request_done(team_id: str, todo_id: str, body: NoteIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> TodosOut:
    team, me = membership(db, team_id, user)
    todo = find_todo(db, team.id, todo_id, user, me.role == LEADER)
    if todo.assignee_id != user.id:
        raise ApiError(403, "assignee_only", "담당자만 할 수 있어요.")
    if todo.status != DOING:
        raise ApiError(409, "invalid_status", "진행 중인 할 일만 완료를 요청할 수 있어요.")
    if len(body.note) > NOTE_MAX:
        raise ApiError(400, "invalid_input", "수행 내용이 너무 길어요.")
    todo.note, todo.status = body.note.strip(), REQUESTED
    db.commit()
    return todos_out(db, team.id, user, me.role == LEADER)


@router.post("/todos/{todo_id}/confirm", summary="확인 완료 (팀장만, 완료 요청 상태일 때). 팀장의 할 일도 팀장이 직접 확인")
def confirm_todo(team_id: str, todo_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> TodosOut:
    team = leader_only(db, team_id, user)
    todo = find_todo(db, team.id, todo_id, user, True)
    if todo.status != REQUESTED:
        raise ApiError(409, "invalid_status", "완료 요청된 할 일만 확인할 수 있어요.")
    todo.status = DONE
    db.commit()
    return todos_out(db, team.id, user, True)


@router.put("/todos/{todo_id}/note", summary="수행 내용 저장. 진행 중에는 담당자만, 확인 완료 뒤에는 담당자와 팀장이 고칠 수 있음")
def save_note(team_id: str, todo_id: str, body: NoteIn, user: User = Depends(current_user), db: Session = Depends(get_db)) -> TodosOut:
    team, me = membership(db, team_id, user)
    leader = me.role == LEADER
    todo = find_todo(db, team.id, todo_id, user, leader)
    allowed = (todo.status == DOING and todo.assignee_id == user.id) or (todo.status == DONE and (leader or todo.assignee_id == user.id))
    if not allowed:
        raise ApiError(409, "invalid_status", "지금은 수행 내용을 고칠 수 없어요.")
    if len(body.note) > NOTE_MAX:
        raise ApiError(400, "invalid_input", "수행 내용이 너무 길어요.")
    todo.note = body.note.strip()
    db.commit()
    return todos_out(db, team.id, user, leader)
