import { DAY_LABELS, type Day, type TimetableEntry } from '../types'
import { formatHour } from './format'

/** 공통 가능 시간을 계산하는 시간 범위 (9시 ~ 21시, 30분 단위) */
export const WINDOW_START = 9
export const WINDOW_END = 21

export interface Range {
  start: number
  end: number
}

export interface DayAvailability {
  day: Day
  /** 그날 가장 많이 가능한 인원 수 */
  people: number
  /** 그 인원이 가능한 시간 구간 */
  ranges: Range[]
  /** 30분 칸마다 가능한 인원 수 (WINDOW_START 부터) */
  slots: number[]
}

export interface Pick {
  day: Day
  start: number
  end: number
  people: number
  label: string
}

export interface Availability {
  /** 시간표를 입력한 팀원 수(계산에 쓴 인원) */
  total: number
  days: DayAvailability[]
  picks: Pick[]
}

function isBusy(entries: TimetableEntry[], day: Day, t: number): boolean {
  return entries.some((e) => e.day === day && t >= e.start && t < e.end)
}

/**
 * 팀원들의 바쁜 시간으로부터 공통 가능 시간을 계산한다.
 * - 요일마다 전원이 가능한 시간이 있으면 그 시간만, 없으면 가장 많은 인원이 가능한 시간만 보여준다.
 * - 바쁜 시간만 입력받고, 나머지를 가능한 시간으로 본다.
 */
export function computeAvailability(timetables: TimetableEntry[][]): Availability {
  const total = timetables.length
  const slotCount = (WINDOW_END - WINDOW_START) * 2
  const days: DayAvailability[] = ([0, 1, 2, 3, 4, 5, 6] as Day[]).map((day) => {
    const slots = Array.from({ length: slotCount }, (_, s) => {
      const t = WINDOW_START + s / 2
      return timetables.filter((entries) => !isBusy(entries, day, t)).length
    })
    const best = total === 0 ? 0 : Math.max(...slots)
    const ranges: Range[] = []
    let start: number | null = null
    for (let s = 0; s <= slotCount; s++) {
      const ok = best > 0 && s < slotCount && slots[s] === best
      if (ok && start === null) start = s
      if (!ok && start !== null) {
        ranges.push({ start: WINDOW_START + start / 2, end: WINDOW_START + s / 2 })
        start = null
      }
    }
    return { day, people: best, ranges, slots }
  })

  // 추천: 인원이 많은 순, 같으면 긴 순, 같으면 이른 요일 순. 1시간 이상만.
  const picks: Pick[] = days
    .flatMap((d) =>
      d.ranges
        .filter((r) => r.end - r.start >= 1)
        .map((r) => ({
          day: d.day,
          start: r.start,
          end: r.end,
          people: d.people,
          label: `${DAY_LABELS[d.day]} ${formatHour(r.start)} ~ ${formatHour(r.end)}`,
        })),
    )
    .sort((a, b) => b.people - a.people || b.end - b.start - (a.end - a.start) || a.day - b.day)
    .slice(0, 3)

  return { total, days, picks }
}
