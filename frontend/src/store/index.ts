import { useSyncExternalStore } from 'react'
import * as seed from '../mocks/seed'
import { decide, singleTopOption } from '../lib/vote'
import type { Day, Goal, Meeting, Team, TimetableEntry, Todo, TodoStatus, User, Vote } from '../types'

/**
 * 앱 전체 상태 (임시, 메모리에만 저장).
 * 백엔드 API 가 정해지면 이 파일의 액션을 API 호출로 바꾸고, 화면 코드는 그대로 둔다.
 * 새로고침하면 예시 데이터로 되돌아간다.
 */
export interface State {
  users: User[]
  teams: Team[]
  currentUserId: string | null
  timetables: Record<string, TimetableEntry[]>
  votes: Record<string, Vote | undefined>
  meetings: Record<string, Meeting | undefined>
  goals: Goal[]
  todos: Todo[]
}

function initial(): State {
  return {
    users: structuredClone(seed.users),
    teams: structuredClone(seed.teams),
    currentUserId: seed.CURRENT_USER_ID,
    timetables: structuredClone(seed.timetables),
    votes: structuredClone(seed.votes),
    meetings: structuredClone(seed.meetings),
    goals: structuredClone(seed.goals),
    todos: structuredClone(seed.todos),
  }
}

let state: State = initial()
const listeners = new Set<() => void>()

function set(next: Partial<State>) {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** 상태 일부를 구독한다. selector 는 같은 입력에 같은(참조가 같은) 값을 돌려줘야 한다. */
export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state))
}

export function getState(): State {
  return state
}

/** 테스트나 시연에서 예시 데이터로 되돌린다 */
export function resetStore() {
  state = initial()
  listeners.forEach((l) => l())
}

let idSeq = 100
const newId = (prefix: string) => `${prefix}${++idSeq}`

// ───── 읽기 도우미 ─────

export function userName(s: State, id: string): string {
  return s.users.find((u) => u.id === id)?.name ?? '알 수 없음'
}

export function currentUser(s: State): User | undefined {
  return s.users.find((u) => u.id === s.currentUserId)
}

export function teamById(s: State, id: string | undefined): Team | undefined {
  return s.teams.find((t) => t.id === id)
}

/** 내가 속한 팀들 */
export function myTeams(s: State): Team[] {
  return s.teams.filter((t) => t.memberIds.includes(s.currentUserId ?? ''))
}

export function isLeader(s: State, teamId: string): boolean {
  return teamById(s, teamId)?.leaderId === s.currentUserId
}

/** 이 팀 소속으로 보이는 할 일: 팀장은 전체, 팀원은 본인 것만 */
export function visibleTodos(s: State, teamId: string): Todo[] {
  const all = s.todos.filter((t) => t.teamId === teamId)
  return isLeader(s, teamId) ? all : all.filter((t) => t.assigneeId === s.currentUserId)
}

// ───── 계정 ─────

export const auth = {
  /** 아이디·비밀번호가 맞으면 로그인한다 */
  login(loginId: string, password: string): boolean {
    const user = state.users.find((u) => u.loginId === loginId)
    const account = user && seed.accounts.find((a) => a.userId === user.id)
    if (!user || !account || account.password !== password) return false
    set({ currentUserId: user.id })
    return true
  },
  logout() {
    set({ currentUserId: null })
  },
  isLoginIdTaken(loginId: string): boolean {
    return state.users.some((u) => u.loginId === loginId.trim())
  },
  signup(input: { name: string; loginId: string; password: string; studentId: string; question: string; answer: string }): boolean {
    if (auth.isLoginIdTaken(input.loginId)) return false
    const id = newId('u')
    const user: User = { id, name: input.name.trim(), loginId: input.loginId.trim(), studentId: input.studentId.trim() }
    seed.accounts.push({ userId: id, password: input.password, question: input.question, answer: input.answer.trim().toLowerCase() })
    set({ users: [...state.users, user], currentUserId: id, timetables: { ...state.timetables, [id]: [] } })
    return true
  },
  /** 이름과 학번이 일치하는 계정의 아이디 */
  findLoginId(name: string, studentId: string): string | null {
    return state.users.find((u) => u.name === name.trim() && u.studentId === studentId.trim())?.loginId ?? null
  },
  /** 비밀번호 찾기용 질문 */
  questionFor(loginId: string): string | null {
    const user = state.users.find((u) => u.loginId === loginId.trim())
    return (user && seed.accounts.find((a) => a.userId === user.id)?.question) ?? null
  },
  /** 질문의 답이 맞는지 (띄어쓰기·대소문자는 무시) */
  checkAnswer(loginId: string, answer: string): boolean {
    const user = state.users.find((u) => u.loginId === loginId.trim())
    const account = user && seed.accounts.find((a) => a.userId === user.id)
    const norm = (v: string) => v.replace(/\s+/g, '').toLowerCase()
    return Boolean(account && norm(account.answer) === norm(answer))
  },
  resetPassword(loginId: string, password: string): void {
    const user = state.users.find((u) => u.loginId === loginId.trim())
    const account = user && seed.accounts.find((a) => a.userId === user.id)
    if (account) account.password = password
  },
  /** 로그인한 사용자의 비밀번호 변경. 현재 비밀번호가 틀리면 false */
  changePassword(current: string, next: string): boolean {
    const account = seed.accounts.find((a) => a.userId === state.currentUserId)
    if (!account || account.password !== current) return false
    account.password = next
    return true
  },
}

// ───── 팀 ─────

export const teamActions = {
  create(name: string): Team {
    const team: Team = {
      id: newId('t'),
      name: name.trim(),
      leaderId: state.currentUserId ?? '',
      memberIds: [state.currentUserId ?? ''],
      inviteCode: Math.random().toString(36).slice(2, 8),
      inviteDaysLeft: 7,
    }
    set({ teams: [...state.teams, team] })
    return team
  },
  /** 초대 코드로 팀을 찾는다 (만료 여부 포함) */
  findByInvite(code: string): { team: Team; expired: boolean } | null {
    if (code === seed.EXPIRED_INVITE_CODE) {
      return { team: { ...state.teams[0] }, expired: true }
    }
    const team = state.teams.find((t) => t.inviteCode === code)
    return team ? { team, expired: team.inviteDaysLeft <= 0 } : null
  },
  join(teamId: string) {
    const me = state.currentUserId ?? ''
    set({
      teams: state.teams.map((t) => (t.id === teamId && !t.memberIds.includes(me) ? { ...t, memberIds: [...t.memberIds, me] } : t)),
    })
  },
  /** 새 초대 링크를 만든다 (7일) */
  renewInvite(teamId: string) {
    set({ teams: state.teams.map((t) => (t.id === teamId ? { ...t, inviteCode: Math.random().toString(36).slice(2, 8), inviteDaysLeft: 7 } : t)) })
  },
  transferLeader(teamId: string, userId: string) {
    set({ teams: state.teams.map((t) => (t.id === teamId ? { ...t, leaderId: userId } : t)) })
  },
  /** 탈퇴. 팀장은 먼저 팀장을 넘겨야 한다(false 반환) */
  leave(teamId: string): boolean {
    const me = state.currentUserId ?? ''
    if (isLeader(state, teamId)) return false
    set({ teams: state.teams.map((t) => (t.id === teamId ? { ...t, memberIds: t.memberIds.filter((m) => m !== me) } : t)) })
    return true
  },
}

// ───── 시간표 ─────

export const timetableActions = {
  add(entry: Omit<TimetableEntry, 'id'>): { ok: true } | { ok: false; reason: 'order' | 'overlap'; conflict?: TimetableEntry } {
    const me = state.currentUserId ?? ''
    if (entry.end <= entry.start) return { ok: false, reason: 'order' }
    const mine = state.timetables[me] ?? []
    const conflict = mine.find((x) => x.day === entry.day && entry.start < x.end && x.start < entry.end)
    if (conflict) return { ok: false, reason: 'overlap', conflict }
    set({ timetables: { ...state.timetables, [me]: [...mine, { ...entry, id: newId('e') }] } })
    return { ok: true }
  },
  remove(entryId: string) {
    const me = state.currentUserId ?? ''
    set({ timetables: { ...state.timetables, [me]: (state.timetables[me] ?? []).filter((x) => x.id !== entryId) } })
  },
}

// ───── 일정(투표·회의) ─────

export const scheduleActions = {
  /** 새 투표 만들기. 진행 중인 투표가 있으면 만들 수 없다 */
  createVote(teamId: string, options: Array<{ day: Day; start: number }>): boolean {
    if (state.votes[teamId]) return false
    const vote: Vote = {
      id: newId('v'),
      teamId,
      createdBy: state.currentUserId ?? '',
      options: options.map((o) => ({ id: newId('o'), ...o })),
      ballots: {},
      hoursLeft: 24,
      revote: false,
      ended: false,
    }
    set({ votes: { ...state.votes, [teamId]: vote }, meetings: { ...state.meetings, [teamId]: undefined } })
    return true
  },
  /** 내 표를 저장하고, 과반이면 확정·동률이면 재투표로 넘어간다 */
  castVote(teamId: string, optionIds: string[]) {
    const vote = state.votes[teamId]
    const team = teamById(state, teamId)
    if (!vote || !team) return
    const next: Vote = { ...vote, ballots: { ...vote.ballots, [state.currentUserId ?? '']: optionIds } }
    const decision = decide(next, team.memberIds.length)
    if (decision.kind === 'confirmed') {
      const opt = next.options.find((o) => o.id === decision.optionId)!
      set({
        votes: { ...state.votes, [teamId]: undefined },
        meetings: { ...state.meetings, [teamId]: { teamId, day: opt.day, start: opt.start, votes: decision.votes } },
      })
    } else if (decision.kind === 'tie') {
      set({
        votes: {
          ...state.votes,
          [teamId]: { ...next, options: next.options.filter((o) => decision.optionIds.includes(o.id)), ballots: {}, revote: true },
        },
      })
    } else {
      set({ votes: { ...state.votes, [teamId]: next } })
    }
  },
  /** 진행 중인 투표 취소 (만든 사람이나 팀장) */
  cancelVote(teamId: string) {
    set({ votes: { ...state.votes, [teamId]: undefined } })
  },
  /** 24시간이 지나 마감된 것으로 만든다 (시연용) */
  endVote(teamId: string) {
    const vote = state.votes[teamId]
    if (vote) set({ votes: { ...state.votes, [teamId]: { ...vote, hoursLeft: 0, ended: true } } })
  },
  /** 마감 후 팀장이 단독 최다표 후보로 확정 */
  confirmEnded(teamId: string): boolean {
    const vote = state.votes[teamId]
    if (!vote) return false
    const optionId = singleTopOption(vote)
    const opt = vote.options.find((o) => o.id === optionId)
    if (!opt) return false
    const votes = Object.values(vote.ballots).filter((b) => b.includes(opt.id)).length
    set({
      votes: { ...state.votes, [teamId]: undefined },
      meetings: { ...state.meetings, [teamId]: { teamId, day: opt.day, start: opt.start, votes } },
    })
    return true
  },
  /** 마감된 투표를 닫고 새로 시작할 수 있게 한다 */
  restartVote(teamId: string) {
    set({ votes: { ...state.votes, [teamId]: undefined } })
  },
  /** 확정된 회의 시간 변경 (팀장만) */
  changeMeeting(teamId: string, day: Day, start: number) {
    const m = state.meetings[teamId]
    if (m) set({ meetings: { ...state.meetings, [teamId]: { ...m, day, start } } })
  },
}

// ───── 목표·할 일 ─────

export interface TodoDraft {
  id?: string
  title: string
  assigneeId: string
  due: string
}

export const todoActions = {
  /** 목표와 개인 목표(할 일)를 함께 만든다 (팀장) */
  createGoal(teamId: string, title: string, drafts: TodoDraft[]): string {
    const goalId = newId('g')
    const todos: Todo[] = drafts.map((d) => ({
      id: newId('td'),
      goalId,
      teamId,
      title: d.title,
      assigneeId: d.assigneeId,
      due: d.due,
      status: 'doing',
      note: '',
    }))
    set({ goals: [...state.goals, { id: goalId, teamId, title }], todos: [...state.todos, ...todos] })
    return goalId
  },
  /** 목표 이름과 개인 목표를 고친다. drafts 에 없는 기존 할 일은 삭제, id 없는 항목은 새로 추가 */
  updateGoal(goalId: string, title: string, drafts: TodoDraft[]) {
    const goal = state.goals.find((g) => g.id === goalId)
    if (!goal) return
    const keepIds = new Set(drafts.filter((d) => d.id).map((d) => d.id))
    const kept = state.todos
      .filter((t) => t.goalId !== goalId || keepIds.has(t.id))
      .map((t) => {
        const d = drafts.find((x) => x.id === t.id)
        return d ? { ...t, title: d.title, assigneeId: d.assigneeId, due: d.due } : t
      })
    const added: Todo[] = drafts
      .filter((d) => !d.id)
      .map((d) => ({ id: newId('td'), goalId, teamId: goal.teamId, title: d.title, assigneeId: d.assigneeId, due: d.due, status: 'doing' as const, note: '' }))
    set({ goals: state.goals.map((g) => (g.id === goalId ? { ...g, title } : g)), todos: [...kept, ...added] })
  },
  /** 목표를 지우면 안의 개인 목표도 함께 지워진다 */
  deleteGoal(goalId: string) {
    set({ goals: state.goals.filter((g) => g.id !== goalId), todos: state.todos.filter((t) => t.goalId !== goalId) })
  },
  setStatus(todoId: string, status: TodoStatus) {
    set({ todos: state.todos.map((t) => (t.id === todoId ? { ...t, status } : t)) })
  },
  /** 수행 내용 저장 (확인 완료 후에도 수정할 수 있다) */
  saveNote(todoId: string, note: string) {
    set({ todos: state.todos.map((t) => (t.id === todoId ? { ...t, note } : t)) })
  },
}

/** 전체 상태를 구독한다. 화면에서는 이 값을 myTeams(s), isLeader(s, id) 같은 읽기 도우미에 넘겨 쓴다. */
export function useAppState(): State {
  return useStore((s) => s)
}
