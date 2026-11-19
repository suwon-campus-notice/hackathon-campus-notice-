import { computeAvailability, type Availability } from '../../lib/availability'
import { userName, type State } from '../../store'
import type { Team } from '../../types'

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
