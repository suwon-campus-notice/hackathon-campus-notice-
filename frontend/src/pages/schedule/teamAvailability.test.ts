import { describe, expect, it } from 'vitest'
import { getState } from '../../store'
import { teamAvailability } from './teamAvailability'

describe('teamAvailability', () => {
  it('시간표를 입력하지 않은 팀원은 계산에서 빼고 이름을 알려준다', () => {
    const s = getState()
    const team = s.teams.find((t) => t.id === 't1')!
    const r = teamAvailability(s, team)
    expect(r.entered).toBe(2)
    expect(r.availability.total).toBe(2)
    expect(r.notEntered).toEqual(['민수', '서연'])
  })
})
