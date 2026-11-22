import { describe, expect, it } from 'vitest'
import type { TimetableEntry } from '../types'
import { computeAvailability } from './availability'

const entry = (day: TimetableEntry['day'], start: number, end: number): TimetableEntry => ({
  id: `${day}-${start}`,
  day,
  start,
  end,
  kind: 'class',
})

describe('computeAvailability', () => {
  it('바쁜 시간이 없으면 하루 종일(9~21시) 전원 가능', () => {
    const r = computeAvailability([[], []])
    expect(r.total).toBe(2)
    expect(r.days[0].people).toBe(2)
    expect(r.days[0].ranges).toEqual([{ start: 9, end: 21 }])
  })

  it('전원 가능한 시간이 있으면 그 구간만 보여준다', () => {
    const r = computeAvailability([[entry(0, 9, 12)], [entry(0, 10, 14)]])
    expect(r.days[0].people).toBe(2)
    expect(r.days[0].ranges).toEqual([{ start: 14, end: 21 }])
  })

  it('전원 가능한 시간이 없으면 가장 많은 인원이 가능한 시간을 보여준다', () => {
    const r = computeAvailability([[entry(0, 9, 21)], [entry(0, 9, 14)], [entry(0, 9, 12)]])
    // 3명 중 1명(A)은 하루 종일 바쁘므로 전원 가능은 없고, 14~21시에 2명이 가능하다
    expect(r.days[0].people).toBe(2)
    expect(r.days[0].ranges).toEqual([{ start: 14, end: 21 }])
  })

  it('아무도 가능하지 않은 요일은 구간이 없다', () => {
    const r = computeAvailability([[entry(2, 9, 21)]])
    expect(r.days[2].people).toBe(0)
    expect(r.days[2].ranges).toEqual([])
  })

  it('추천 시간은 인원이 많은 순, 같으면 긴 순이고 1시간 이상만 포함한다', () => {
    const r = computeAvailability([[entry(0, 9, 20.5), entry(1, 9, 18)], []])
    const labels = r.picks.map((p) => p.label)
    // 월요일은 20:30~21:00(30분)이라 제외, 화요일 18:00~21:00(3시간)보다 전원 가능한 수요일 이후가 우선
    expect(labels[0].startsWith('수')).toBe(true)
    expect(labels).not.toContain('월 20:30 ~ 21:00')
    expect(r.picks.length).toBeLessThanOrEqual(3)
  })

  it('팀원이 없으면 결과가 비어 있다', () => {
    const r = computeAvailability([])
    expect(r.picks).toEqual([])
    expect(r.days.every((d) => d.ranges.length === 0)).toBe(true)
  })
})
