import type { Goal, Meeting, Team, TimetableEntry, Todo, User, Vote } from '../types'

/**
 * 백엔드가 생기기 전까지 쓰는 예시 데이터.
 * API 가 정해지면 이 파일과 store 의 액션을 API 호출로 바꾼다.
 */

export const users: User[] = [
  { id: 'u1', name: '진우', loginId: 'jinwoo', studentId: '20231234' },
  { id: 'u2', name: '민수', loginId: 'minsu', studentId: '20231235' },
  { id: 'u3', name: '지훈', loginId: 'jihoon', studentId: '20231236' },
  { id: 'u4', name: '서연', loginId: 'seoyeon', studentId: '20231237' },
  { id: 'u5', name: '하늘', loginId: 'haneul', studentId: '20231238' },
]

/** 로그인과 비밀번호 찾기를 흉내 내기 위한 계정 (예시) */
export interface Account {
  userId: string
  password: string
  question: string
  answer: string
}

export const accounts: Account[] = [
  { userId: 'u1', password: '1234', question: '가장 기억에 남는 여행지는?', answer: '제주' },
  { userId: 'u2', password: '1234', question: '어릴 적 별명은?', answer: '민수' },
]

export const SECURITY_QUESTIONS = [
  '어릴 적 가장 좋아했던 장난감은?',
  '가장 기억에 남는 여행지는?',
  '처음 키운 반려동물이나 식물의 이름은?',
  '어릴 적 별명은?',
  '처음으로 본 영화 제목은?',
  '가장 오래 다닌 학원이나 동아리 이름은?',
  '어릴 적 살던 동네 이름은?',
  '가장 좋아하는 책 제목은?',
  '처음 받아 본 선물은?',
  '가장 기억에 남는 수업 이름은?',
] as const

export const teams: Team[] = [
  { id: 't1', name: '소프트웨어공학 팀플', leaderId: 'u1', memberIds: ['u1', 'u2', 'u3', 'u4'], inviteCode: 'k7Q2xP', inviteDaysLeft: 5 },
  { id: 't2', name: '해커톤 팀', leaderId: 'u2', memberIds: ['u1', 'u2', 'u3', 'u4', 'u5'], inviteCode: 'h4Ck0n', inviteDaysLeft: 3 },
  { id: 't3', name: '데이터과학 프로젝트', leaderId: 'u3', memberIds: ['u1', 'u3', 'u4'], inviteCode: 'dS2026', inviteDaysLeft: 6 },
]

/** 만료된 초대 링크 예시 */
export const EXPIRED_INVITE_CODE = 'old123'

let n = 0
const e = (day: TimetableEntry['day'], start: number, end: number, kind: TimetableEntry['kind'] = 'class'): TimetableEntry => ({
  id: `seed-${++n}`,
  day,
  start,
  end,
  kind,
})

/** userId → 바쁜 시간. u2(민수)·u4(서연)는 아직 입력하지 않은 상태(빈 목록)로 둔다. */
export const timetables: Record<string, TimetableEntry[]> = {
  u1: [e(0, 10, 12), e(0, 14, 15.5), e(1, 9, 10.5), e(1, 13, 15), e(2, 10, 12), e(3, 9, 10.5), e(3, 13, 15), e(4, 11, 12), e(5, 9, 21, 'blocked')],
  u2: [],
  u3: [e(0, 10, 12), e(1, 10, 12), e(2, 11, 13), e(3, 9, 10), e(3, 15, 17), e(4, 13, 15), e(5, 14, 18, 'blocked')],
  u4: [],
  u5: [e(0, 9, 11), e(0, 13, 15), e(1, 10, 12), e(2, 13, 15), e(3, 10, 12), e(4, 9, 11), e(4, 14, 16)],
}

/** 팀 t1: 투표 진행 중 (진우는 아직 투표하지 않음) */
export const votes: Record<string, Vote | undefined> = {
  t1: {
    id: 'vote-t1',
    teamId: 't1',
    createdBy: 'u3',
    options: [
      { id: 'o1', day: 2, start: 15 },
      { id: 'o2', day: 0, start: 16 },
      { id: 'o3', day: 6, start: 14 },
    ],
    ballots: { u2: ['o1'], u3: ['o1', 'o2'], u4: ['o2'] },
    hoursLeft: 23,
    revote: false,
    ended: false,
  },
}

/** 팀 t2: 회의가 이미 확정된 상태 */
export const meetings: Record<string, Meeting | undefined> = {
  t2: { teamId: 't2', day: 2, start: 15, votes: 4 },
}

export const goals: Goal[] = [
  { id: 'g1', teamId: 't1', title: '중간 발표 준비' },
  { id: 'g2', teamId: 't1', title: '최종 보고서' },
  { id: 'g3', teamId: 't2', title: '아이디어 정리' },
]

export const todos: Todo[] = [
  { id: 'td1', goalId: 'g1', teamId: 't1', title: '발표 자료 초안 작성', assigneeId: 'u1', due: '2026-11-24', status: 'doing', note: '' },
  { id: 'td2', goalId: 'g1', teamId: 't1', title: '시연 영상 촬영', assigneeId: 'u2', due: '2026-11-26', status: 'doing', note: '' },
  { id: 'td3', goalId: 'g1', teamId: 't1', title: '발표 대본 작성', assigneeId: 'u3', due: '2026-11-25', status: 'requested', note: '발표 대본 초안을 작성했어요. 슬라이드 1~8장 분량이고, 읽어 보니 약 10분 걸려요. 팀원 의견을 받아 수정할 예정이에요.' },
  { id: 'td4', goalId: 'g2', teamId: 't1', title: '보고서 목차 정리', assigneeId: 'u4', due: '2026-11-30', status: 'done', note: '보고서 목차를 1장 개요부터 5장 결론까지 5개 장으로 정리했어요.' },
  { id: 'td5', goalId: 'g2', teamId: 't1', title: '참고 문헌 정리', assigneeId: 'u2', due: '2026-12-02', status: 'doing', note: '' },
  { id: 'td6', goalId: 'g3', teamId: 't2', title: '아이디어 후보 5개 정리', assigneeId: 'u1', due: '2026-11-22', status: 'doing', note: '' },
]

export const CURRENT_USER_ID = 'u1'
