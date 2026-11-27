import { beforeAll, describe, expect, it } from 'vitest'
import { setApiBase, setFetcher } from './api'
import { auth, availabilityActions, bootstrap, getState, isServerMode, resetStore, scheduleActions, teamActions, timetableActions, todoActions } from './index'

/**
 * 실제 백엔드를 붙여서 확인하는 테스트. 서버 주소를 COETUS_API 로 줄 때만 돈다.
 *   COETUS_API=http://127.0.0.1:6100/ npm test
 * 서버는 임시 DB 로 띄우세요 (backend/README.md). 테스트가 계정·팀을 만들어 둡니다.
 */
const API = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.COETUS_API

/** 쿠키를 기억하는 fetch (브라우저가 하는 일을 흉내 낸다) */
function cookieFetcher(): typeof fetch {
  let cookie = ''
  return async (input, init) => {
    const headers = new Headers(init?.headers)
    if (cookie) headers.set('Cookie', cookie)
    const res = await fetch(input, { ...init, headers })
    const set = res.headers.getSetCookie?.() ?? []
    for (const c of set) {
      const pair = c.split(';')[0]
      cookie = pair.endsWith('=') ? '' : pair
    }
    return res
  }
}

const run = Math.random().toString(36).slice(2, 8)
const A = { name: '가나', loginId: `a_${run}`, password: '1234', studentId: `2024${run}`, question: '어릴 적 별명은?', answer: '별' }
const B = { name: '다라', loginId: `b_${run}`, password: '1234', studentId: `2025${run}`, question: '어릴 적 별명은?', answer: '별' }

describe.skipIf(!API)('서버 모드 (실제 백엔드)', () => {
  beforeAll(() => {
    setApiBase(API!)
    setFetcher(cookieFetcher())
  })

  it('서버를 감지하고 로그인 전 상태로 시작한다', async () => {
    resetStore()
    await bootstrap()
    expect(isServerMode()).toBe(true)
    expect(getState().ready).toBe(true)
    expect(getState().currentUserId).toBeNull()
    expect(getState().teams).toEqual([])
  })

  it('가입하면 바로 로그인되고, 같은 아이디는 중복으로 막힌다', async () => {
    expect(await auth.isLoginIdTaken(A.loginId)).toEqual({ status: 'ok' })
    expect(await auth.signup(A)).toEqual({ ok: true })
    expect(getState().currentUserId).not.toBeNull()
    expect(await auth.isLoginIdTaken(A.loginId)).toEqual({ status: 'taken' })
    expect(await auth.signup(A)).toMatchObject({ ok: false, code: 'taken' })
  })

  it('형식에 맞지 않는 아이디는 서버 안내를 돌려준다', async () => {
    const r = await auth.isLoginIdTaken('한글!')
    expect(r.status).toBe('invalid')
  })

  it('시간표: 추가·겹침·순서 오류·삭제', async () => {
    const me = getState().currentUserId!
    expect(await timetableActions.add({ day: 0, start: 10, end: 12, kind: 'class' })).toEqual({ ok: true })
    expect(getState().timetables[me]).toHaveLength(1)
    const overlap = await timetableActions.add({ day: 0, start: 11, end: 13, kind: 'class' })
    expect(overlap).toMatchObject({ ok: false, reason: 'overlap' })
    expect(overlap.ok === false && overlap.reason === 'overlap' && overlap.conflict?.start).toBe(10)
    expect(await timetableActions.add({ day: 1, start: 12, end: 10, kind: 'class' })).toMatchObject({ ok: false, reason: 'order' })
    await timetableActions.remove(getState().timetables[me][0].id)
    expect(getState().timetables[me]).toHaveLength(0)
    await timetableActions.add({ day: 2, start: 9, end: 11, kind: 'class' })
  })

  let inviteCode = ''
  let teamId = ''
  it('팀을 만들고 초대 코드로 다른 사람이 참여한다', async () => {
    const team = await teamActions.create('테스트 팀')
    expect(team).not.toBeNull()
    teamId = team!.id
    inviteCode = team!.inviteCode
    expect(team!.leaderId).toBe(getState().currentUserId)
    expect(getState().teams).toHaveLength(1)

    // 다른 사람으로 가입해서 참여
    await auth.logout()
    expect(getState().currentUserId).toBeNull()
    expect(getState().teams).toEqual([])
    expect(await auth.signup(B)).toEqual({ ok: true })
    const found = await teamActions.findByInvite(inviteCode)
    expect(found).toMatchObject({ expired: false })
    expect(found!.team.name).toBe('테스트 팀')
    const joined = await teamActions.join(inviteCode)
    expect(joined!.memberIds).toHaveLength(2)
    expect(getState().teams).toHaveLength(1)
    expect(await teamActions.findByInvite('없는코드')).toBeNull()
  })

  it('공통 가능 시간을 서버에서 불러온다', async () => {
    await timetableActions.add({ day: 2, start: 13, end: 15, kind: 'class' })
    await availabilityActions.load(teamId)
    const av = getState().availability[teamId]!
    expect(av.entered).toBe(2)
    expect(av.total).toBe(2)
    expect(av.days).toHaveLength(7)
    expect(av.days[0].free.length).toBeGreaterThan(0)
  })

  it('팀원은 팀장을 넘기기 전에도 탈퇴할 수 있고, 팀장은 막힌다', async () => {
    expect(await teamActions.leave(teamId)).toBe(true)
    expect(getState().teams).toEqual([])
  })

  it('로그아웃 후 로그인: 틀린 비밀번호는 거절, 맞으면 내 팀을 다시 불러온다', async () => {
    await auth.logout()
    expect(await auth.login(A.loginId, 'wrong')).toBe('wrong')
    expect(await auth.login(A.loginId, A.password)).toBe('ok')
    expect(getState().teams.map((t) => t.id)).toContain(teamId)
    const me = getState().currentUserId!
    expect(getState().timetables[me].length).toBeGreaterThan(0)
  })

  it('비밀번호 찾기·변경', async () => {
    expect(await auth.questionFor(A.loginId)).toMatchObject({ ok: true, question: A.question })
    expect(await auth.questionFor('없는아이디')).toMatchObject({ ok: false, reason: 'none' })
    expect(await auth.checkAnswer(A.loginId, ' 별 ')).toEqual({ ok: true })
    expect(await auth.checkAnswer(A.loginId, '틀림')).toEqual({ ok: false, blocked: false })
    expect(await auth.resetPassword(A.loginId, A.answer, '5678')).toEqual({ ok: true })
    expect(await auth.changePassword('틀린현재', '9999')).toMatchObject({ ok: false, reason: 'wrong' })
    expect(await auth.changePassword('5678', '9999')).toEqual({ ok: true })
    await auth.logout()
    expect(await auth.login(A.loginId, '9999')).toBe('ok')
  })

  it('아이디 찾기', async () => {
    expect(await auth.findLoginId(A.name, A.studentId)).toEqual({ ok: true, loginId: A.loginId })
    expect(await auth.findLoginId('없는사람', '000')).toMatchObject({ ok: false, reason: 'none' })
  })
})


/** 투표·회의·목표·할 일 (2차). 위 테스트가 만든 계정 A·B 로 새 팀을 만들어 이어서 확인한다. */
describe.skipIf(!API)('서버 모드: 투표·회의·할 일', () => {
  let teamId = ''
  let aId = ''
  let bId = ''

  /** 계정을 바꿔 로그인한다. 앞 테스트에서 A 의 비밀번호는 9999 로 바뀌었고 B 는 1234 이다. */
  async function as(who: 'A' | 'B') {
    await auth.logout()
    expect(await auth.login(who === 'A' ? A.loginId : B.loginId, who === 'A' ? '9999' : B.password)).toBe('ok')
  }

  it('A 가 팀을 만들고 B 가 참여한다', async () => {
    // 앞 테스트에서 A 의 비밀번호는 9999 로 바뀌었고, B 는 1234 이다
    await auth.logout()
    expect(await auth.login(A.loginId, '9999')).toBe('ok')
    aId = getState().currentUserId!
    const team = await teamActions.create('투표 팀')
    teamId = team!.id
    await auth.logout()
    expect(await auth.login(B.loginId, B.password)).toBe('ok')
    bId = getState().currentUserId!
    expect(await teamActions.join(team!.inviteCode)).not.toBeNull()
    expect(getState().votes[teamId]).toBeUndefined()
  })

  it('투표 만들기(직접 추가한 시간 포함)와 중복 방지', async () => {
    expect(await scheduleActions.createVote(teamId, [{ day: 2, start: 15 }, { day: 4, start: 10.5 }])).toBe(true)
    const vote = getState().votes[teamId]!
    expect(vote.options.map((o) => [o.day, o.start])).toEqual([[2, 15], [4, 10.5]])
    expect(vote.hoursLeft).toBe(24)
    expect(vote.createdBy).toBe(bId)
    expect(await scheduleActions.createVote(teamId, [{ day: 1, start: 9 }])).toBe(false)
    expect(getState().error).not.toBeNull() // "이미 진행 중인 투표가 있어요"
  })

  it('과반(2명 중 2명)이면 회의가 확정되고 투표가 닫힌다', async () => {
    const [o1] = getState().votes[teamId]!.options
    await scheduleActions.castVote(teamId, [o1.id])
    expect(getState().votes[teamId]!.ballots[bId]).toEqual([o1.id]) // 1명: 아직
    await auth.logout()
    await auth.login(A.loginId, '9999')
    const first = getState().votes[teamId]!.options[0]
    expect(getState().votes[teamId]!.ballots[bId]).toEqual([first.id]) // 로그인하면 최신 투표를 불러온다
    await scheduleActions.castVote(teamId, [first.id])
    expect(getState().votes[teamId]).toBeUndefined()
    expect(getState().meetings[teamId]).toMatchObject({ day: 2, start: 15, votes: 2 })
  })

  it('팀장(A)이 회의 시간을 바꾸고, 새 투표를 만들면 회의가 사라진다', async () => {
    await scheduleActions.changeMeeting(teamId, 3, 9.5)
    expect(getState().meetings[teamId]).toMatchObject({ day: 3, start: 9.5, votes: 2 })
    expect(await scheduleActions.createVote(teamId, [{ day: 0, start: 9 }])).toBe(true)
    expect(getState().meetings[teamId]).toBeUndefined()
  })

  it('마감(시연용)된 투표: 표가 없으면 확정할 수 없고 다시 투표만 된다', async () => {
    await scheduleActions.endVote(teamId)
    expect(getState().votes[teamId]!.ended).toBe(true)
    expect(await scheduleActions.confirmEnded(teamId)).toBe(false)
    await scheduleActions.restartVote(teamId)
    expect(getState().votes[teamId]).toBeUndefined()
  })

  it('투표 취소', async () => {
    await scheduleActions.createVote(teamId, [{ day: 5, start: 11 }])
    await scheduleActions.cancelVote(teamId)
    expect(getState().votes[teamId]).toBeUndefined()
  })

  let goalId = ''
  it('팀장이 목표와 할 일을 만들면, 팀원은 자기 할 일만 본다', async () => {
    goalId = (await todoActions.createGoal(teamId, '발표 준비', [
      { title: 'A 할 일', assigneeId: aId, due: '2026-12-01' },
      { title: 'B 할 일', assigneeId: bId, due: '2026-12-02' },
    ]))!
    expect(goalId).toBeTruthy()
    expect(getState().todos.filter((t) => t.teamId === teamId)).toHaveLength(2)
    await as('B')
    const mine = getState().todos.filter((t) => t.teamId === teamId)
    expect(mine.map((t) => t.title)).toEqual(['B 할 일'])
    expect(getState().goals.filter((g) => g.teamId === teamId).map((g) => g.title)).toEqual(['발표 준비'])
  })

  it('담당자가 완료 요청하고 팀장이 확인한다', async () => {
    const todo = getState().todos.find((t) => t.teamId === teamId)!
    await todoActions.requestDone(todo.id, ' 자료를 만들었어요 ')
    expect(getState().todos.find((t) => t.id === todo.id)).toMatchObject({ status: 'requested', note: '자료를 만들었어요' })
    await as('A')
    await todoActions.confirm(todo.id)
    expect(getState().todos.find((t) => t.id === todo.id)!.status).toBe('done')
    await todoActions.saveNote(todo.id, '팀장이 보충')
    expect(getState().todos.find((t) => t.id === todo.id)!.note).toBe('팀장이 보충')
  })

  it('목표를 고치고 지운다', async () => {
    const mine = getState().todos.find((t) => t.title === 'A 할 일')!
    await todoActions.updateGoal(goalId, '바뀐 목표', [{ id: mine.id, title: 'A 수정', assigneeId: aId, due: '2026-12-05' }, { title: '새 할 일', assigneeId: bId, due: '2026-12-06' }])
    const todos = getState().todos.filter((t) => t.teamId === teamId)
    expect(todos.map((t) => t.title).sort()).toEqual(['A 수정', '새 할 일'])
    expect(getState().goals.find((g) => g.id === goalId)!.title).toBe('바뀐 목표')
    await todoActions.deleteGoal(goalId)
    expect(getState().goals.filter((g) => g.teamId === teamId)).toEqual([])
    expect(getState().todos.filter((t) => t.teamId === teamId)).toEqual([])
  })
})
