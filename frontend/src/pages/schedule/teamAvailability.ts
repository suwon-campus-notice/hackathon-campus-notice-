import { computeAvailability, isBusy, type Availability } from '../../lib/availability'
import { isServerMode, userName, type State } from '../../store'
import type { Day, Team } from '../../types'

export interface TeamAvailability {
  availability: Availability
  /** 아직 시간표를 입력하지 않은 팀원 이름 */
  notEntered: string[]
  /** 시간표를 입력한 팀원 수 */
  entered: number
  /** 서버에서 공통 가능 시간을 아직 불러오는 중인지 */
  loading: boolean
}

/** 팀원들의 시간표로 공통 가능 시간을 계산한다. 시간표가 비어 있는 팀원은 계산에서 뺀다. */
export function teamAvailability(s: State, team: Team): TeamAvailability {
  // 서버 모드: 서버가 계산한 결과를 쓴다 (다른 팀원의 시간표는 이 기기에 없다)
  if (isServerMode()) {
    const server = s.availability[team.id]
    if (!server) return { availability: computeAvailability([]), notEntered: [], entered: 0, loading: true }
    return { availability: server, notEntered: server.notEntered, entered: server.entered, loading: false }
  }
  const enteredIds = team.memberIds.filter((id) => (s.timetables[id] ?? []).length > 0)
  const notEntered = team.memberIds.filter((id) => !enteredIds.includes(id)).map((id) => userName(s, id))
  const availability = computeAvailability(enteredIds.map((id) => s.timetables[id]))
  return { availability, notEntered, entered: enteredIds.length, loading: false }
}

/** 그 요일·시각(30분 칸의 시작)에 가능한 팀원과 바쁜 팀원 이름. 시간표를 입력한 팀원만 센다. */
export function membersAt(s: State, team: Team, day: Day, t: number): { free: string[]; busy: string[] } {
  if (isServerMode()) {
    const server = s.availability[team.id]
    const slot = server ? Math.round((t - server.windowStart) * 2) : -1
    const d = server?.days[day]
    return { free: d?.free[slot] ?? [], busy: d?.busy[slot] ?? [] }
  }
  const free: string[] = []
  const busy: string[] = []
  for (const id of team.memberIds) {
    const entries = s.timetables[id] ?? []
    if (entries.length === 0) continue
    ;(isBusy(entries, day, t) ? busy : free).push(userName(s, id))
  }
  return { free, busy }
}
