import { useSyncExternalStore } from 'react'
import * as seed from '../mocks/seed'
import type { Account } from '../mocks/seed'
import { decide, singleTopOption } from '../lib/vote'
import type { Day, Goal, Meeting, Team, TimetableEntry, Todo, TodoStatus, User, Vote } from '../types'
import { createSync } from './sync'
import * as testSession from './testSession'

/**
 * 앱 전체 상태.
 * - 공유 부분(SHARED_KEYS)은 테스트 서버(backend/)와 동기화해서 여러 기기가 같은 내용을 본다. 규칙은 여기서 그대로 처리한다.
 * - currentUserId(로그인한 사람)와 ready 는 이 기기에만 있다.
 * - 서버가 없으면(정적 호스팅, 테스트) 예시 데이터로만 동작하고 새로고침하면 되돌아간다.
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
  /** 로그인·비밀번호 찾기용 계정 (테스트 서버라 비밀번호를 그대로 둔다. 정식 백엔드에서는 서버만 가진다) */
  accounts: Account[]
  /** 서버 첫 로딩이 끝났는지 (서버가 없어도 true) */
  ready: boolean
  /** 서버에 연결돼 있는지 */
  connected: boolean
}

/** 서버와 공유하는 키. 나머지는 기기마다 따로다. */
const SHARED_KEYS = ['users', 'teams', 'timetables', 'votes', 'meetings', 'goals', 'todos', 'accounts'] as const
type Shared = Pick<State, (typeof SHARED_KEYS)[number]>

/** 브라우저에서 실행 중이고 테스트가 아니면 서버와 동기화한다 */
const SYNC = typeof window !== 'undefined' && typeof document !== 'undefined' && !import.meta.env.VITEST
const USER_KEY = 'coetus.currentUserId'

function storedUserId(): string | null {
  try { return localStorage.getItem(USER_KEY) } catch { return null }
}
function storeUserId(id: string | null) {
  try {
    if (id) localStorage.setItem(USER_KEY, id)
    else localStorage.removeItem(USER_KEY)
  } catch { /* 저장 못 해도 동작에는 지장 없음 */ }
}

function seedShared(): Shared {
  return {
    users: structuredClone(seed.users),
    teams: structuredClone(seed.teams),
    timetables: structuredClone(seed.timetables),
    votes: structuredClone(seed.votes),
    meetings: structuredClone(seed.meetings),
    goals: structuredClone(seed.goals),
    todos: structuredClone(seed.todos),
    accounts: structuredClone(seed.accounts),
  }
}

function initial(): State {
  return {
    ...seedShared(),
    // 서버 모드: 이 기기에 저장된 로그인만 인정. 테스트·서버 없음: 예시 사용자로 로그인된 상태
    currentUserId: SYNC ? storedUserId() : seed.CURRENT_USER_ID,
    ready: !SYNC,
    connected: false,
  }
}

let state: State = initial()
const listeners = new Set<() => void>()
/** 마지막 액션이 공유 부분을 바꿨는지 (바꿨으면 서버로 보낸다) */
let dirty = false

function set(next: Partial<State>) {
  state = { ...state, ...next }
  if (SHARED_KEYS.some((k) => k in next)) dirty = true
  if ('currentUserId' in next && SYNC) storeUserId(next.currentUserId ?? null)
  listeners.forEach((l) => l())
}

const sync = createSync<Shared>({
  getShared: () => Object.fromEntries(SHARED_KEYS.map((k) => [k, state[k]])) as unknown as Shared,
  applyRemote: (shared) => {
    state = { ...state, ...shared }
    listeners.forEach((l) => l())
  },
  seed: seedShared,
  onStatus: ({ connected, ready }) => {
    if (state.connected !== connected || state.ready !== ready) {
      state = { ...state, connected, ready }
      listeners.forEach((l) => l())
    }
  },
})

/**
 * 액션 묶음을 감싼다: 액션이 공유 상태를 바꿨으면 서버로 보내고, 충돌 때 다시 실행할 수 있게 기록한다.
 * 화면 코드는 바뀌지 않는다 (같은 이름, 같은 반환값).
 */
function tracked<T extends Record<string, (...args: never[]) => unknown>>(actions: T): T {
  if (!SYNC) return actions
  const out: Record<string, unknown> = {}
  for (const [name, fn] of Object.entries(actions)) {
    out[name] = (...args: never[]) => {
      if (sync.isReplaying()) return fn(...args)
      dirty = false
      const result = fn(...args)
      if (dirty) { dirty = false; sync.push(() => { fn(...args) }) }
      return result
    }
  }
  return out as T
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

/** 테스트나 시연에서 예시 데이터로 되돌린다 (이 기기만) */
export function resetStore() {
  state = initial()
  listeners.forEach((l) => l())
}

/** 서버 문서를 비우고 예시 데이터로 되돌린다 (모든 기기에 적용) */
export async function resetShared(): Promise<void> {
  if (!SYNC) { resetStore(); return }
  await fetch('api/reset', { method: 'POST' }).catch(() => undefined)
  await sync.pull(true)
}

/** 기기가 달라도 겹치지 않는 id */
const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

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

const accountOf = (userId: string | null | undefined) => state.accounts.find((a) => a.userId === userId)
const updateAccount = (userId: string, patch: Partial<Account>) =>
  set({ accounts: state.accounts.map((a) => (a.userId === userId ? { ...a, ...patch } : a)) })

export type LoginResult = { ok: true } | { ok: false; reason: 'wrong' | 'busy'; minutesLeft?: number }

export const auth = tracked({
  /**
   * 아이디·비밀번호가 맞으면 로그인한다.
   * 테스트 계정(팀장, 팀원1~4)은 한 사람씩만 쓸 수 있어서 서버 잠금을 얻어야 한다 (다른 사람이 쓰는 중이면 busy).
   */
  async login(loginId: string, password: string): Promise<LoginResult> {
    const user = state.users.find((u) => u.loginId === loginId)
    const account = user && accountOf(user.id)
    if (!user || !account || account.password !== password) return { ok: false, reason: 'wrong' }
    if (SYNC) {
      const lock = await testSession.acquire(loginId)
      if (lock.test && !lock.ok) return { ok: false, reason: 'busy', minutesLeft: lock.minutesLeft }
    }
    set({ currentUserId: user.id })
    return { ok: true }
  },
  logout() {
    set({ currentUserId: null })
    if (SYNC) void testSession.release()
  },
  isLoginIdTaken(loginId: string): boolean {
    return state.users.some((u) => u.loginId === loginId.trim())
  },
  signup(input: { name: string; loginId: string; password: string; studentId: string; question: string; answer: string }): boolean {
    if (auth.isLoginIdTaken(input.loginId)) return false
    const id = newId('u')
    const user: User = { id, name: input.name.trim(), loginId: input.loginId.trim(), studentId: input.studentId.trim() }
    const account: Account = { userId: id, password: input.password, question: input.question, answer: input.answer.trim().toLowerCase() }
    set({ users: [...state.users, user], accounts: [...state.accounts, account], currentUserId: id, timetables: { ...state.timetables, [id]: [] } })
    return true
  },
  /** 이름과 학번이 일치하는 계정의 아이디 */
  findLoginId(name: string, studentId: string): string | null {
    return state.users.find((u) => u.name === name.trim() && u.studentId === studentId.trim())?.loginId ?? null
  },
  /** 비밀번호 찾기용 질문 */
  questionFor(loginId: string): string | null {
    const user = state.users.find((u) => u.loginId === loginId.trim())
    return (user && accountOf(user.id)?.question) ?? null
  },
  /** 질문의 답이 맞는지 (띄어쓰기·대소문자는 무시) */
  checkAnswer(loginId: string, answer: string): boolean {
    const user = state.users.find((u) => u.loginId === loginId.trim())
    const account = user && accountOf(user.id)
    const norm = (v: string) => v.replace(/\s+/g, '').toLowerCase()
    return Boolean(account && norm(account.answer) === norm(answer))
  },
  resetPassword(loginId: string, password: string): void {
    const user = state.users.find((u) => u.loginId === loginId.trim())
    if (user && accountOf(user.id)) updateAccount(user.id, { password })
  },
  /** 로그인한 사용자의 비밀번호 변경. 현재 비밀번호가 틀리면 false */
  changePassword(current: string, next: string): boolean {
    const account = accountOf(state.currentUserId)
    if (!account || account.password !== current) return false
    updateAccount(account.userId, { password: next })
    return true
  },
})

// ───── 팀 ─────

export const teamActions = tracked({
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
})

// ───── 시간표 ─────

export const timetableActions = tracked({
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
})

// ───── 일정(투표·회의) ─────

export const scheduleActions = tracked({
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
})

// ───── 목표·할 일 ─────

export interface TodoDraft {
  id?: string
  title: string
  assigneeId: string
  due: string
}

export const todoActions = tracked({
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
})

/** 전체 상태를 구독한다. 화면에서는 이 값을 myTeams(s), isLeader(s, id) 같은 읽기 도우미에 넘겨 쓴다. */
export function useAppState(): State {
  return useStore((s) => s)
}

if (SYNC) {
  sync.start()
  // 테스트 계정: 10분 동안 활동이 없거나 잠금을 잃으면 자동 로그아웃
  testSession.watch(() => {
    if (state.currentUserId) set({ currentUserId: null })
    window.location.hash = '#/login?expired=1'
  })
}
