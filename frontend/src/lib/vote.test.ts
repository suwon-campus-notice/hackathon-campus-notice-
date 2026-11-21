import { describe, expect, it } from 'vitest'
import type { Vote } from '../types'
import { decide, majority, singleTopOption, tally } from './vote'

const vote = (ballots: Vote['ballots']): Vote => ({
  id: 'v',
  teamId: 't',
  createdBy: 'u1',
  options: [
    { id: 'a', day: 2, start: 15 },
    { id: 'b', day: 0, start: 16 },
    { id: 'c', day: 6, start: 14 },
  ],
  ballots,
  hoursLeft: 12,
  revote: false,
  ended: false,
})

describe('majority', () => {
  it('전체 팀원의 절반을 넘는 인원', () => {
    expect(majority(4)).toBe(3)
    expect(majority(5)).toBe(3)
    expect(majority(3)).toBe(2)
    expect(majority(2)).toBe(2)
  })
})

describe('tally', () => {
  it('복수 선택을 후보별로 센다', () => {
    const t = tally(vote({ u1: ['a'], u2: ['a', 'b'], u3: ['b'] }))
    expect(t).toEqual({ a: 2, b: 2, c: 0 })
  })
})

describe('decide', () => {
  it('과반을 넘은 후보가 없으면 진행 중', () => {
    expect(decide(vote({ u1: ['a'], u2: ['a'] }), 4)).toEqual({ kind: 'pending' })
  })

  it('과반을 넘은 후보가 하나면 그 후보로 확정', () => {
    expect(decide(vote({ u1: ['a'], u2: ['a'], u3: ['a', 'b'] }), 4)).toEqual({
      kind: 'confirmed',
      optionId: 'a',
      votes: 3,
    })
  })

  it('과반을 넘은 후보가 여럿이면 표가 가장 많은 후보로 확정', () => {
    const r = decide(vote({ u1: ['a', 'b'], u2: ['a', 'b'], u3: ['a', 'b'], u4: ['a'] }), 4)
    expect(r).toEqual({ kind: 'confirmed', optionId: 'a', votes: 4 })
  })

  it('최다표가 같으면 그 후보들끼리 재투표', () => {
    const r = decide(vote({ u1: ['a', 'b'], u2: ['a', 'b'], u3: ['a', 'b'] }), 4)
    expect(r).toEqual({ kind: 'tie', optionIds: ['a', 'b'] })
  })
})

describe('singleTopOption', () => {
  it('마감 후 단독 최다표 후보를 돌려준다', () => {
    expect(singleTopOption(vote({ u1: ['a'], u2: ['a'], u3: ['b'] }))).toBe('a')
  })

  it('최다표가 동률이거나 표가 없으면 null', () => {
    expect(singleTopOption(vote({ u1: ['a'], u2: ['b'] }))).toBeNull()
    expect(singleTopOption(vote({}))).toBeNull()
  })
})
