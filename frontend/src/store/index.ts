import { useSyncExternalStore } from 'react'
import * as seed from '../mocks/seed'
import { decide, singleTopOption } from '../lib/vote'
import type { Availability, DayAvailability } from '../lib/availability'
import { api, ApiError, serverIsUp } from './api'
import type { Day, Goal, Meeting, Team, TimetableEntry, Todo, User, Vote } from '../types'

/**
 * 앱 전체 상태 (임시, 메모리에만 저장).
 * 백엔드 API 가 정해지면 이 파일의 액션을 API 호출로 바꾸고, 화면 코드는 그대로 둔다.
 * 새로고침하면 예시 데이터로 되돌아간다.
 */
/** 서버가 계산해 주는 공통 가능 시간 (프론트 Availability 에 덧붙인 필드가 있다) */
export interface ServerAvailability extends Availability {
  entered: number
  notEntered: string[]
  windowStart: number
  windowEnd: number
  days: Array<DayAvailability & { free: string[][]; busy: string[][] }>
}

export interface State {
  /** 첫 화면 준비(서버 확인·로그인 상태 조회)가 끝났는지 */
  ready: boolean
  /** 화면 위에 띄울 오류 안내 */
  error: string | null
  /** 팀별 공통 가능 시간 (서버 모드에서만 채워진다) */
  availability: Record<string, ServerAvailability | undefined>
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
    ready: true,
    error: null,
    availability: {},
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
  serverMode = false
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

// ───── 서버 연결 ─────
//
// 서버(백엔드)가 떠 있으면 서버 모드: 계정·팀·시간표를 API 로 주고받는다.
// 서버가 없으면(정적 호스팅, 테스트) 예시 데이터로 도는 목 모드를 그대로 쓴다.
// 투표·회의·목표·할 일도 서버 모드에서는 서버에 저장하고, 목 모드에서는 이 파일의 메모리 상태를 쓴다.

let serverMode = false

export function isServerMode(): boolean {
  return serverMode
}

/** 서버 오류를 사람이 읽을 안내 문장으로 */
function failMessage(e: unknown): string {
  return e instanceof ApiError ? e.message : '문제가 생겼어요. 잠시 후 다시 시도해 주세요.'
}

/** 로그인이 풀렸다(쿠키 만료 등): 로그인 화면으로 보낸다 */
function clearSession() {
  set({ currentUserId: null, teams: [], timetables: {}, availability: {}, votes: {}, meetings: {}, goals: [], todos: [] })
}

/** 서버 호출. 로그인이 풀린 응답(401 not_logged_in)이면 세션을 비운 뒤 오류를 그대로 던진다. */
async function call<T = void>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  try {
    return await api<T>(method, path, body)
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && e.code === 'not_logged_in') clearSession()
    throw e
  }
}

/** 화면에서 결과를 따로 보여 주지 않는 동작의 오류를 화면 위 안내로 띄운다 */
function reportError(e: unknown) {
  if (e instanceof ApiError && e.status === 401 && e.code === 'not_logged_in') return
  set({ error: failMessage(e) })
}

export function dismissError() {
  set({ error: null })
}

/** 이미 아는 사용자에 이름만 아는 팀원을 보태서 돌려준다 */
function withMembers(users: User[], members: Array<{ id: string; name: string }>): User[] {
  const known = new Set(users.map((u) => u.id))
  const added = members.filter((m) => !known.has(m.id)).map((m): User => ({ id: m.id, name: m.name, loginId: '', studentId: '' }))
  return added.length ? [...users, ...added] : users
}

/** 팀 한 개를 목록에 넣는다(있으면 바꾼다) */
function upsertTeam(team: Team) {
  const exists = state.teams.some((t) => t.id === team.id)
  set({
    teams: exists ? state.teams.map((t) => (t.id === team.id ? team : t)) : [...state.teams, team],
    users: withMembers(state.users, team.members ?? []),
  })
}

/** 로그인한 사용자의 팀과 시간표를 서버에서 가져와 상태에 넣는다 */
async function enterSession(me: User) {
  const [teams, entries] = await Promise.all([call<Team[]>('GET', 'teams'), call<TimetableEntry[]>('GET', 'timetable')])
  set({
    currentUserId: me.id,
    users: withMembers([me], teams.flatMap((t) => t.members ?? [])),
    teams,
    timetables: { [me.id]: entries },
    availability: {},
    votes: {},
    meetings: {},
    goals: [],
    todos: [],
  })
  await refreshTeams(teams.map((t) => t.id))
}

/** 팀의 투표·회의·목표·할 일을 서버에서 다시 불러온다 (서버 모드에서만) */
export async function refreshTeams(teamIds: string[]): Promise<void> {
  if (!serverMode) return
  await Promise.all(teamIds.flatMap((id) => [scheduleActions.load(id), todoActions.load(id)]))
}

/** 앱을 켤 때 한 번 부른다: 서버가 있는지 확인하고, 있으면 로그인 상태를 불러온다 */
export async function bootstrap(): Promise<void> {
  set({ ready: false })
  serverMode = await serverIsUp()
  if (serverMode) {
    // 서버 모드에서는 예시 데이터를 쓰지 않는다 (투표·할 일도 서버에서 불러온다)
    state = {
      ...initial(),
      ready: false,
      users: [],
      teams: [],
      currentUserId: null,
      timetables: {},
      votes: {},
      meetings: {},
      goals: [],
      todos: [],
    }
    try {
      await enterSession(await call<User>('GET', 'auth/me'))
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) reportError(e)
    }
  }
  set({ ready: true })
}

// ───── 계정 ─────

export type LoginResult = 'ok' | 'wrong' | 'error'
export type IdCheck = { status: 'ok' } | { status: 'taken' } | { status: 'invalid'; message: string }
export type SignupResult = { ok: true } | { ok: false; code: 'taken' | 'invalid'; message: string }
export type FindIdResult = { ok: true; loginId: string } | { ok: false; reason: 'none' | 'blocked' | 'error'; message: string }
export type QuestionResult = { ok: true; question: string } | { ok: false; reason: 'none' | 'error'; message: string }
export type AnswerResult = { ok: true } | { ok: false; blocked: boolean; message?: string }
export type ResetResult = { ok: true } | { ok: false; message: string }
export type PasswordChangeResult = { ok: true } | { ok: false; reason: 'wrong' | 'invalid'; message: string }

const normAnswer = (v: string) => v.replace(/\s+/g, '').toLowerCase()

export const auth = {
  /** 아이디·비밀번호가 맞으면 로그인한다 */
  async login(loginId: string, password: string): Promise<LoginResult> {
    if (serverMode) {
      try {
        await enterSession(await call<User>('POST', 'auth/login', { loginId: loginId.trim(), password }))
        return 'ok'
      } catch (e) {
        if (e instanceof ApiError && e.code === 'login_failed') return 'wrong'
        reportError(e)
        return 'error'
      }
    }
    const user = state.users.find((u) => u.loginId === loginId)
    const account = user && seed.accounts.find((a) => a.userId === user.id)
    if (!user || !account || account.password !== password) return 'wrong'
    set({ currentUserId: user.id })
    return 'ok'
  },
  async logout(): Promise<void> {
    if (serverMode) {
      try {
        await call('POST', 'auth/logout')
      } catch {
        // 서버에 닿지 않아도 이 기기에서는 로그아웃한다
      }
      clearSession()
      return
    }
    set({ currentUserId: null })
  },
  async isLoginIdTaken(loginId: string): Promise<IdCheck> {
    if (serverMode) {
      try {
        const r = await call<{ taken: boolean }>('GET', `auth/check-id?loginId=${encodeURIComponent(loginId.trim())}`)
        return r.taken ? { status: 'taken' } : { status: 'ok' }
      } catch (e) {
        return { status: 'invalid', message: failMessage(e) }
      }
    }
    return state.users.some((u) => u.loginId === loginId.trim()) ? { status: 'taken' } : { status: 'ok' }
  },
  async signup(input: { name: string; loginId: string; password: string; studentId: string; question: string; answer: string }): Promise<SignupResult> {
    if (serverMode) {
      try {
        const me = await call<User>('POST', 'auth/signup', {
          name: input.name.trim(),
          loginId: input.loginId.trim(),
          password: input.password,
          studentId: input.studentId.trim(),
          question: input.question,
          answer: input.answer.trim(),
        })
        await enterSession(me)
        return { ok: true }
      } catch (e) {
        const taken = e instanceof ApiError && e.code === 'login_id_taken'
        return { ok: false, code: taken ? 'taken' : 'invalid', message: failMessage(e) }
      }
    }
    if (state.users.some((u) => u.loginId === input.loginId.trim())) return { ok: false, code: 'taken', message: '이미 사용 중인 아이디예요.' }
    const id = newId('u')
    const user: User = { id, name: input.name.trim(), loginId: input.loginId.trim(), studentId: input.studentId.trim() }
    seed.accounts.push({ userId: id, password: input.password, question: input.question, answer: input.answer.trim().toLowerCase() })
    set({ users: [...state.users, user], currentUserId: id, timetables: { ...state.timetables, [id]: [] } })
    return { ok: true }
  },
  /** 이름과 학번이 일치하는 계정의 아이디 */
  async findLoginId(name: string, studentId: string): Promise<FindIdResult> {
    if (serverMode) {
      try {
        const r = await call<{ loginId: string }>('POST', 'auth/find-id', { name: name.trim(), studentId: studentId.trim() })
        return { ok: true, loginId: r.loginId }
      } catch (e) {
        const reason = e instanceof ApiError && e.status === 404 ? 'none' : e instanceof ApiError && e.status === 429 ? 'blocked' : 'error'
        return { ok: false, reason, message: failMessage(e) }
      }
    }
    const found = state.users.find((u) => u.name === name.trim() && u.studentId === studentId.trim())?.loginId
    return found ? { ok: true, loginId: found } : { ok: false, reason: 'none', message: '일치하는 계정이 없어요.' }
  },
  /** 비밀번호 찾기용 질문 */
  async questionFor(loginId: string): Promise<QuestionResult> {
    if (serverMode) {
      try {
        const r = await call<{ question: string }>('POST', 'auth/password-question', { loginId: loginId.trim() })
        return { ok: true, question: r.question }
      } catch (e) {
        return { ok: false, reason: e instanceof ApiError && e.status === 404 ? 'none' : 'error', message: failMessage(e) }
      }
    }
    const user = state.users.find((u) => u.loginId === loginId.trim())
    const question = user && seed.accounts.find((a) => a.userId === user.id)?.question
    return question ? { ok: true, question } : { ok: false, reason: 'none', message: '일치하는 계정이 없어요.' }
  },
  /** 질문의 답이 맞는지 (띄어쓰기·대소문자는 무시). 서버는 5번 틀리면 15분간 막는다. */
  async checkAnswer(loginId: string, answer: string): Promise<AnswerResult> {
    if (serverMode) {
      try {
        await call('POST', 'auth/password-check', { loginId: loginId.trim(), answer })
        return { ok: true }
      } catch (e) {
        if (e instanceof ApiError && e.code === 'wrong_answer') return { ok: false, blocked: false }
        return { ok: false, blocked: e instanceof ApiError && e.status === 429, message: failMessage(e) }
      }
    }
    const user = state.users.find((u) => u.loginId === loginId.trim())
    const account = user && seed.accounts.find((a) => a.userId === user.id)
    return account && normAnswer(account.answer) === normAnswer(answer) ? { ok: true } : { ok: false, blocked: false }
  },
  /** 서버는 보안상 확인한 답을 한 번 더 받는다 */
  async resetPassword(loginId: string, answer: string, password: string): Promise<ResetResult> {
    if (serverMode) {
      try {
        await call('POST', 'auth/password-reset', { loginId: loginId.trim(), answer, newPassword: password })
        return { ok: true }
      } catch (e) {
        return { ok: false, message: failMessage(e) }
      }
    }
    const user = state.users.find((u) => u.loginId === loginId.trim())
    const account = user && seed.accounts.find((a) => a.userId === user.id)
    if (account) account.password = password
    return { ok: true }
  },
  /** 로그인한 사용자의 비밀번호 변경 */
  async changePassword(current: string, next: string): Promise<PasswordChangeResult> {
    if (serverMode) {
      try {
        await call('POST', 'auth/password-change', { currentPassword: current, newPassword: next })
        return { ok: true }
      } catch (e) {
        const wrong = e instanceof ApiError && e.code === 'wrong_password'
        return { ok: false, reason: wrong ? 'wrong' : 'invalid', message: failMessage(e) }
      }
    }
    const account = seed.accounts.find((a) => a.userId === state.currentUserId)
    if (!account || account.password !== current) return { ok: false, reason: 'wrong', message: '현재 비밀번호가 맞지 않아요.' }
    account.password = next
    return { ok: true }
  },
}

// ───── 팀 ─────

export const teamActions = {
  async create(name: string): Promise<Team | null> {
    if (serverMode) {
      try {
        const team = await call<Team>('POST', 'teams', { name: name.trim() })
        upsertTeam(team)
        return team
      } catch (e) {
        reportError(e)
        return null
      }
    }
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
  async findByInvite(code: string): Promise<{ team: Team; expired: boolean } | null> {
    if (serverMode) {
      try {
        const found = await call<{ team: Team; expired: boolean }>('GET', `invites/${encodeURIComponent(code)}`)
        set({ users: withMembers(state.users, found.team.members ?? []) })
        return found
      } catch (e) {
        if (!(e instanceof ApiError && e.status === 404)) reportError(e)
        return null
      }
    }
    if (code === seed.EXPIRED_INVITE_CODE) {
      return { team: { ...state.teams[0] }, expired: true }
    }
    const team = state.teams.find((t) => t.inviteCode === code)
    return team ? { team, expired: team.inviteDaysLeft <= 0 } : null
  },
  /** 초대 코드로 팀에 참여한다. 이미 팀원이면 그대로 팀을 돌려준다. */
  async join(code: string): Promise<Team | null> {
    if (serverMode) {
      try {
        const team = await call<Team>('POST', `invites/${encodeURIComponent(code)}/join`)
        upsertTeam(team)
        return team
      } catch (e) {
        reportError(e)
        return null
      }
    }
    const me = state.currentUserId ?? ''
    const team = state.teams.find((t) => t.inviteCode === code)
    if (!team) return null
    const joined = team.memberIds.includes(me) ? team : { ...team, memberIds: [...team.memberIds, me] }
    set({ teams: state.teams.map((t) => (t.id === team.id ? joined : t)) })
    return joined
  },
  /** 새 초대 링크를 만든다 (7일) */
  async renewInvite(teamId: string): Promise<void> {
    if (serverMode) {
      try {
        upsertTeam(await call<Team>('POST', `teams/${teamId}/invite/renew`))
      } catch (e) {
        reportError(e)
      }
      return
    }
    set({ teams: state.teams.map((t) => (t.id === teamId ? { ...t, inviteCode: Math.random().toString(36).slice(2, 8), inviteDaysLeft: 7 } : t)) })
  },
  async transferLeader(teamId: string, userId: string): Promise<void> {
    if (serverMode) {
      try {
        upsertTeam(await call<Team>('POST', `teams/${teamId}/leader`, { userId }))
      } catch (e) {
        reportError(e)
      }
      return
    }
    set({ teams: state.teams.map((t) => (t.id === teamId ? { ...t, leaderId: userId } : t)) })
  },
  /** 탈퇴. 팀장은 먼저 팀장을 넘겨야 한다(false 반환) */
  async leave(teamId: string): Promise<boolean> {
    const me = state.currentUserId ?? ''
    if (isLeader(state, teamId)) return false
    if (serverMode) {
      try {
        await call('POST', `teams/${teamId}/leave`)
        set({ teams: state.teams.filter((t) => t.id !== teamId) })
        return true
      } catch (e) {
        reportError(e)
        return false
      }
    }
    set({ teams: state.teams.map((t) => (t.id === teamId ? { ...t, memberIds: t.memberIds.filter((m) => m !== me) } : t)) })
    return true
  },
}

// ───── 시간표 ─────

export type TimetableAddResult =
  | { ok: true }
  | { ok: false; reason: 'order' | 'overlap'; conflict?: TimetableEntry }
  | { ok: false; reason: 'error'; message: string }

export const timetableActions = {
  async add(entry: Omit<TimetableEntry, 'id'>): Promise<TimetableAddResult> {
    const me = state.currentUserId ?? ''
    if (serverMode) {
      try {
        const saved = await call<TimetableEntry>('POST', 'timetable', entry)
        set({ timetables: { ...state.timetables, [me]: [...(state.timetables[me] ?? []), saved] }, availability: {} })
        return { ok: true }
      } catch (e) {
        if (e instanceof ApiError && e.code === 'overlap') return { ok: false, reason: 'overlap', conflict: e.extra.conflict as TimetableEntry | undefined }
        if (e instanceof ApiError && e.code === 'invalid_order') return { ok: false, reason: 'order' }
        return { ok: false, reason: 'error', message: failMessage(e) }
      }
    }
    if (entry.end <= entry.start) return { ok: false, reason: 'order' }
    const mine = state.timetables[me] ?? []
    const conflict = mine.find((x) => x.day === entry.day && entry.start < x.end && x.start < entry.end)
    if (conflict) return { ok: false, reason: 'overlap', conflict }
    set({ timetables: { ...state.timetables, [me]: [...mine, { ...entry, id: newId('e') }] } })
    return { ok: true }
  },
  async remove(entryId: string): Promise<void> {
    const me = state.currentUserId ?? ''
    if (serverMode) {
      try {
        await call('DELETE', `timetable/${entryId}`)
      } catch (e) {
        reportError(e)
        return
      }
      set({ timetables: { ...state.timetables, [me]: (state.timetables[me] ?? []).filter((x) => x.id !== entryId) }, availability: {} })
      return
    }
    set({ timetables: { ...state.timetables, [me]: (state.timetables[me] ?? []).filter((x) => x.id !== entryId) } })
  },
}

// ───── 공통 가능 시간 ─────

export const availabilityActions = {
  /** 서버 모드에서 팀의 공통 가능 시간을 불러온다 (목 모드에서는 시간표로 직접 계산하므로 할 일이 없다) */
  async load(teamId: string): Promise<void> {
    if (!serverMode) return
    try {
      const data = await call<ServerAvailability>('GET', `teams/${teamId}/availability`)
      set({ availability: { ...state.availability, [teamId]: data } })
    } catch (e) {
      reportError(e)
    }
  },
}

// ───── 일정(투표·회의) ─────

/** 서버가 모든 투표·회의 동작에 돌려주는 모양 */
interface ScheduleData {
  vote: Vote | null
  meeting: Meeting | null
}

function applySchedule(teamId: string, data: ScheduleData) {
  set({
    votes: { ...state.votes, [teamId]: data.vote ?? undefined },
    meetings: { ...state.meetings, [teamId]: data.meeting ?? undefined },
  })
}

/** 서버 모드: 투표·회의 동작 하나를 보내고 결과를 상태에 넣는다. 실패하면 안내를 띄우고 최신 상태를 다시 불러온다. */
async function scheduleCall(teamId: string, method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<boolean> {
  try {
    applySchedule(teamId, await call<ScheduleData>(method, `teams/${teamId}/${path}`, body))
    return true
  } catch (e) {
    reportError(e)
    await scheduleActions.load(teamId)
    return false
  }
}

export const scheduleActions = {
  /** 서버 모드에서 팀의 투표·확정된 회의를 불러온다 */
  async load(teamId: string): Promise<void> {
    if (!serverMode) return
    try {
      applySchedule(teamId, await call<ScheduleData>('GET', `teams/${teamId}/schedule`))
    } catch (e) {
      reportError(e)
    }
  },
  /** 새 투표 만들기. 진행 중인 투표가 있으면 만들 수 없다 */
  async createVote(teamId: string, options: Array<{ day: Day; start: number }>): Promise<boolean> {
    if (serverMode) return scheduleCall(teamId, 'POST', 'vote', { options })
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
  async castVote(teamId: string, optionIds: string[]): Promise<void> {
    if (serverMode) {
      await scheduleCall(teamId, 'PUT', 'vote/ballot', { optionIds })
      return
    }
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
  async cancelVote(teamId: string): Promise<void> {
    if (serverMode) {
      await scheduleCall(teamId, 'DELETE', 'vote')
      return
    }
    set({ votes: { ...state.votes, [teamId]: undefined } })
  },
  /** 24시간이 지나 마감된 것으로 만든다 (시연용, 팀장) */
  async endVote(teamId: string): Promise<void> {
    if (serverMode) {
      await scheduleCall(teamId, 'POST', 'vote/end')
      return
    }
    const vote = state.votes[teamId]
    if (vote) set({ votes: { ...state.votes, [teamId]: { ...vote, hoursLeft: 0, ended: true } } })
  },
  /** 마감 후 팀장이 단독 최다표 후보로 확정 */
  async confirmEnded(teamId: string): Promise<boolean> {
    if (serverMode) return scheduleCall(teamId, 'POST', 'vote/confirm')
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
  async restartVote(teamId: string): Promise<void> {
    if (serverMode) {
      await scheduleCall(teamId, 'POST', 'vote/restart')
      return
    }
    set({ votes: { ...state.votes, [teamId]: undefined } })
  },
  /** 확정된 회의 시간 변경 (팀장만) */
  async changeMeeting(teamId: string, day: Day, start: number): Promise<void> {
    if (serverMode) {
      await scheduleCall(teamId, 'PUT', 'meeting', { day, start })
      return
    }
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

/** 서버가 모든 목표·할 일 동작에 돌려주는 모양 (내가 볼 수 있는 것만 들어 있다) */
interface TodosData {
  goals: Goal[]
  todos: Todo[]
}

/** 이 팀의 목표·할 일을 서버가 준 것으로 바꾼다 */
function applyTodos(teamId: string, data: TodosData) {
  set({
    goals: [...state.goals.filter((g) => g.teamId !== teamId), ...data.goals],
    todos: [...state.todos.filter((t) => t.teamId !== teamId), ...data.todos],
  })
}

/** 서버 모드: 목표·할 일 동작 하나를 보내고 결과를 상태에 넣는다. 실패하면 안내를 띄우고 최신 상태를 다시 불러온다. */
async function todoCall<T extends TodosData = TodosData>(teamId: string, method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T | null> {
  try {
    const data = await call<T>(method, `teams/${teamId}/${path}`, body)
    applyTodos(teamId, data)
    return data
  } catch (e) {
    reportError(e)
    await todoActions.load(teamId)
    return null
  }
}

const teamOfTodo = (todoId: string) => state.todos.find((t) => t.id === todoId)?.teamId
const teamOfGoal = (goalId: string) => state.goals.find((g) => g.id === goalId)?.teamId

export const todoActions = {
  /** 서버 모드에서 팀의 목표·할 일을 불러온다 (팀장은 전체, 팀원은 자기 할 일만 온다) */
  async load(teamId: string): Promise<void> {
    if (!serverMode) return
    try {
      applyTodos(teamId, await call<TodosData>('GET', `teams/${teamId}/todos`))
    } catch (e) {
      reportError(e)
    }
  },
  /** 목표와 개인 목표(할 일)를 함께 만든다 (팀장). 만든 목표의 id 를 돌려준다 */
  async createGoal(teamId: string, title: string, drafts: TodoDraft[]): Promise<string | null> {
    if (serverMode) {
      const data = await todoCall<TodosData & { goalId: string }>(teamId, 'POST', 'goals', {
        title,
        todos: drafts.map(({ title, assigneeId, due }) => ({ title, assigneeId, due })),
      })
      return data?.goalId ?? null
    }
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
  async updateGoal(goalId: string, title: string, drafts: TodoDraft[]): Promise<void> {
    const goal = state.goals.find((g) => g.id === goalId)
    if (!goal) return
    if (serverMode) {
      await todoCall(goal.teamId, 'PUT', `goals/${goalId}`, { title, todos: drafts })
      return
    }
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
  async deleteGoal(goalId: string): Promise<void> {
    if (serverMode) {
      const teamId = teamOfGoal(goalId)
      if (teamId) await todoCall(teamId, 'DELETE', `goals/${goalId}`)
      return
    }
    set({ goals: state.goals.filter((g) => g.id !== goalId), todos: state.todos.filter((t) => t.goalId !== goalId) })
  },
  /** 담당자가 수행 내용을 적고 '완료 요청'으로 바꾼다 */
  async requestDone(todoId: string, note: string): Promise<void> {
    if (serverMode) {
      const teamId = teamOfTodo(todoId)
      if (teamId) await todoCall(teamId, 'POST', `todos/${todoId}/request`, { note })
      return
    }
    set({ todos: state.todos.map((t) => (t.id === todoId ? { ...t, note, status: 'requested' } : t)) })
  },
  /** 팀장이 '확인 완료'로 바꾼다 */
  async confirm(todoId: string): Promise<void> {
    if (serverMode) {
      const teamId = teamOfTodo(todoId)
      if (teamId) await todoCall(teamId, 'POST', `todos/${todoId}/confirm`)
      return
    }
    set({ todos: state.todos.map((t) => (t.id === todoId ? { ...t, status: 'done' } : t)) })
  },
  /** 수행 내용 저장 (확인 완료 후에도 수정할 수 있다) */
  async saveNote(todoId: string, note: string): Promise<void> {
    if (serverMode) {
      const teamId = teamOfTodo(todoId)
      if (teamId) await todoCall(teamId, 'PUT', `todos/${todoId}/note`, { note })
      return
    }
    set({ todos: state.todos.map((t) => (t.id === todoId ? { ...t, note } : t)) })
  },
}

/** 전체 상태를 구독한다. 화면에서는 이 값을 myTeams(s), isLeader(s, id) 같은 읽기 도우미에 넘겨 쓴다. */
export function useAppState(): State {
  return useStore((s) => s)
}
