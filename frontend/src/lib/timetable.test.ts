import { describe, expect, it } from 'vitest'
import { freeSegments } from './timetable'

describe('freeSegments', () => {
  it('아무것도 차 있지 않으면 범위 전체가 하나의 구간', () => {
    expect(freeSegments(2, 6, () => false)).toEqual([[2, 6]])
  })

  it('칸 하나도 구간이 된다', () => {
    expect(freeSegments(3, 3, () => false)).toEqual([[3, 3]])
  })

  it('이미 찬 칸은 건너뛰고 빈 구간만 나눠서 돌려준다', () => {
    const busy = new Set([4, 5])
    expect(freeSegments(2, 8, (i) => busy.has(i))).toEqual([[2, 3], [6, 8]])
  })

  it('범위가 모두 차 있으면 구간이 없다', () => {
    expect(freeSegments(1, 3, () => true)).toEqual([])
  })

  it('범위 끝이 차 있어도 앞쪽 빈 구간은 돌려준다', () => {
    expect(freeSegments(0, 3, (i) => i === 3)).toEqual([[0, 2]])
  })
})
