/** 요일: 0=월 … 6=일 */
export type Day = 0 | 1 | 2 | 3 | 4 | 5 | 6

export const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const

export interface User {
  id: string
  name: string
  loginId: string
  studentId: string
}

export interface Team {
  id: string
  name: string
  leaderId: string
  memberIds: string[]
  inviteCode: string
  /** 초대 링크 만료까지 남은 일수 (0 이하면 만료) */
  inviteDaysLeft: number
  /** 서버가 덧붙여 주는 팀원 이름 (이름 표시용) */
  members?: Array<{ id: string; name: string }>
}

/** 시간표에 입력한 바쁜 시간. start/end 는 시(時) 단위 소수 (9.5 = 9시 30분) */
export interface TimetableEntry {
  id: string
  day: Day
  start: number
  end: number
  kind: 'class' | 'blocked'
}

export interface VoteOption {
  id: string
  day: Day
  /** 회의 시작 시각 (15 = 15:00) */
  start: number
}

export interface Vote {
  id: string
  teamId: string
  createdBy: string
  options: VoteOption[]
  /** userId → 고른 후보 id 목록 (복수 선택) */
  ballots: Record<string, string[]>
  /** 투표 마감까지 남은 시간(시간). 0 이면 마감 */
  hoursLeft: number
  /** 동률로 다시 투표하는 중인지 */
  revote: boolean
  /** 과반을 못 넘기고 마감된 투표 */
  ended: boolean
}

export interface Meeting {
  teamId: string
  day: Day
  start: number
  /** 확정 당시 득표 수 */
  votes: number
}

export interface Goal {
  id: string
  teamId: string
  title: string
}

export type TodoStatus = 'doing' | 'requested' | 'done'

export interface Todo {
  id: string
  goalId: string
  teamId: string
  title: string
  assigneeId: string
  /** YYYY-MM-DD */
  due: string
  status: TodoStatus
  /** 수행 내용(한 일과 결과) */
  note: string
}

export const TODO_STATUS_LABELS: Record<TodoStatus, string> = {
  doing: '진행 중',
  requested: '완료 요청',
  done: '확인 완료',
}
