import { computeAvailability, isBusy, type Availability } from '../../lib/availability'
import { userName, type State } from '../../store'
import type { Day, Team } from '../../types'

export interface TeamAvailability {
  availability: Availability
  /** 아직 시간표를 입력하지 않은 팀원 이름 */
  notEntered: string[]
  /** 시간표를 입력한 팀원 수 */
  entered: number
}

/** 팀원들의 시간표로 공통 가능 시간을 계산한다. 시간표가 비어 있는 팀원은 계산에서 뺀다. */
export function teamAvailability(s: State, team: Team): TeamAvailability {
  const enteredIds = team.memberIds.filter((id) => (s.timetables[id] ?? []).length > 0)
  const notEntered = team.memberIds.filter((id) => !enteredIds.includes(id)).map((id) => userName(s, id))
  const availability = computeAvailability(enteredIds.map((id) => s.timetables[id]))
  return { availability, notEntered, entered: enteredIds.length }
}

/** 그 요일·시각(30분 칸의 시작)에 가능한 팀원과 바쁜 팀원 이름. 시간표를 입력한 팀원만 센다. */
export function membersAt(s: State, team: Team, day: Day, t: number): { free: string[]; busy: string[] } {
  const free: string[] = []
  const busy: string[] = []
  for (const id of team.memberIds) {
    const entries = s.timetables[id] ?? []
    if (entries.length === 0) continue
    ;(isBusy(entries, day, t) ? busy : free).push(userName(s, id))
  }
  return { free, busy }
}
