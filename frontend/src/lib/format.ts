import { DAY_LABELS, type Day } from '../types'

/** 9.5 → "09:30", 24 → "24:00" */
export function formatHour(h: number): string {
  const hh = Math.floor(h)
  const mm = h % 1 ? '30' : '00'
  return `${String(hh).padStart(2, '0')}:${mm}`
}

/** (0, 10, 12) → "월 10:00 ~ 12:00" */
export function formatRange(day: Day, start: number, end: number): string {
  return `${DAY_LABELS[day]} ${formatHour(start)} ~ ${formatHour(end)}`
}

/** "2026-11-24" → "11월 24일" */
export function formatDue(due: string): string {
  const [, m, d] = due.split('-')
  return `${Number(m)}월 ${Number(d)}일`
}

/** 시작 시각 선택용: from 부터 to 까지 30분 단위 */
export function timeOptions(from: number, to: number): number[] {
  const out: number[] = []
  for (let h = from; h <= to; h += 0.5) out.push(h)
  return out
}

/** 시간표 표시 끝 시각: 기본 21시, 입력한 일정이 더 늦으면 그 시각(최대 24시)까지 늘어난다 */
export function timetableEndHour(ends: number[], base = 21): number {
  const latest = Math.max(base, ...ends)
  return Math.min(24, Math.ceil(latest))
}
