import { beforeEach, describe, expect, it } from 'vitest'
import { auth, getState, isLeader, resetStore, scheduleActions, teamActions, timetableActions, todoActions, visibleTodos } from './index'

beforeEach(() => resetStore())

describe('투표 흐름', () => {
  it('과반(3명)을 넘으면 자동으로 확정되고 투표가 닫힌다', async () => {
    // 시드: 수 15:00(o1)에 민수·지훈이 투표 → 진우가 더하면 3명
    await scheduleActions.castVote('t1', ['o1'])
    expect(getState().votes.t1).toBeUndefined()
    expect(getState().meetings.t1).toMatchObject({ day: 2, start: 15, votes: 3 })
  })

  it('최다표가 같으면 그 후보들끼리 재투표가 시작된다', async () => {
    // o1: 민수·지훈, o2: 지훈·서연 → 진우가 둘 다 고르면 o1·o2 모두 3표
    await scheduleActions.castVote('t1', ['o1', 'o2'])
    const vote = getState().votes.t1!
    expect(vote.revote).toBe(true)
    expect(vote.options.map((o) => o.id).sort()).toEqual(['o1', 'o2'])
    expect(vote.ballots).toEqual({})
  })

  it('과반이 안 되면 투표가 계속된다', async () => {
    await scheduleActions.castVote('t1', ['o3'])
    expect(getState().votes.t1).toBeDefined()
    expect(getState().meetings.t1).toBeUndefined()
  })

  it('진행 중인 투표가 있으면 새 투표를 만들 수 없다', async () => {
    expect(await scheduleActions.createVote('t1', [{ day: 1, start: 10 }])).toBe(false)
  })

  it('마감 후 단독 최다표 후보를 팀장이 확정한다', async () => {
    await scheduleActions.endVote('t1')
    expect(getState().votes.t1?.ended).toBe(true)
    // 시드: o1·o2 가 2표씩 동률이라 확정할 수 없다
    expect(await scheduleActions.confirmEnded('t1')).toBe(false)
  })

  it('투표를 취소하면 받은 표가 사라진다', async () => {
    await scheduleActions.cancelVote('t1')
    expect(getState().votes.t1).toBeUndefined()
  })
})

describe('팀 규칙', () => {
  it('팀장은 팀장을 넘기기 전에는 탈퇴할 수 없다', async () => {
    expect(isLeader(getState(), 't1')).toBe(true)
    expect(await teamActions.leave('t1')).toBe(false)
    await teamActions.transferLeader('t1', 'u2')
    expect(isLeader(getState(), 't1')).toBe(false)
    expect(await teamActions.leave('t1')).toBe(true)
    expect(getState().teams.find((t) => t.id === 't1')!.memberIds).not.toContain('u1')
  })

  it('만료된 초대 링크는 expired 로 알려준다', async () => {
    expect((await teamActions.findByInvite('old123'))?.expired).toBe(true)
    expect((await teamActions.findByInvite('k7Q2xP'))?.expired).toBe(false)
    expect(await teamActions.findByInvite('nope')).toBeNull()
  })
})

describe('할 일 공개 범위', () => {
  it('팀장은 팀의 모든 할 일을, 팀원은 본인 할 일만 본다', () => {
    expect(visibleTodos(getState(), 't1').length).toBe(5)
    // t2 에서 진우는 팀원이다
    const mine = visibleTodos(getState(), 't2')
    expect(mine.every((t) => t.assigneeId === 'u1')).toBe(true)
  })

  it('목표를 지우면 안의 개인 목표도 함께 지워진다', async () => {
    await todoActions.deleteGoal('g1')
    expect(getState().todos.some((t) => t.goalId === 'g1')).toBe(false)
  })
})

describe('시간표 입력 검증', () => {
  it('종료가 시작보다 빠르면 거절한다', async () => {
    const r = await timetableActions.add({ day: 0, start: 12, end: 10, kind: 'class' })
    expect(r).toMatchObject({ ok: false, reason: 'order' })
  })

  it('겹치는 일정은 거절한다', async () => {
    // 시드: 진우 월 10~12
    const r = await timetableActions.add({ day: 0, start: 11, end: 13, kind: 'class' })
    expect(r).toMatchObject({ ok: false, reason: 'overlap' })
  })
})

describe('계정', () => {
  it('아이디 중복을 알려준다', async () => {
    expect(await auth.isLoginIdTaken('jinwoo')).toEqual({ status: 'taken' })
    expect(await auth.isLoginIdTaken('brand-new')).toEqual({ status: 'ok' })
  })

  it('비밀번호 찾기 답은 띄어쓰기·대소문자를 무시한다', async () => {
    expect(await auth.checkAnswer('jinwoo', ' 제 주 ')).toEqual({ ok: true })
    expect(await auth.checkAnswer('jinwoo', '부산')).toMatchObject({ ok: false })
  })
})
