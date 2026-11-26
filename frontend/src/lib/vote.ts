import type { Vote } from '../types'

/** 과반수: 전체 팀원의 절반을 넘는 인원 (4명이면 3명) */
export function majority(teamSize: number): number {
  return Math.floor(teamSize / 2) + 1
}

/** 후보별 득표 수 */
export function tally(vote: Vote): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(vote.options.map((o) => [o.id, 0]))
  for (const picked of Object.values(vote.ballots)) {
    for (const id of picked) if (id in counts) counts[id] += 1
  }
  return counts
}

export type Decision =
  | { kind: 'confirmed'; optionId: string; votes: number }
  | { kind: 'tie'; optionIds: string[] }
  | { kind: 'pending' }

/**
 * 투표 결과 판정
 * - 과반을 넘은 후보가 없으면 계속 진행(pending)
 * - 과반을 넘은 후보 중 표가 가장 많은 후보로 확정
 * - 최다표가 둘 이상이면 그 후보들끼리 재투표(tie)
 */
export function decide(vote: Vote, teamSize: number): Decision {
  const counts = tally(vote)
  const need = majority(teamSize)
  const passed = vote.options.filter((o) => counts[o.id] >= need)
  if (passed.length === 0) return { kind: 'pending' }
  const top = Math.max(...passed.map((o) => counts[o.id]))
  const winners = passed.filter((o) => counts[o.id] === top)
  if (winners.length === 1) return { kind: 'confirmed', optionId: winners[0].id, votes: top }
  return { kind: 'tie', optionIds: winners.map((o) => o.id) }
}

/** 마감 후 과반이 없을 때, 팀장이 확정할 수 있는 단독 최다표 후보 (동률이면 null) */
export function singleTopOption(vote: Vote): string | null {
  const counts = tally(vote)
  const top = Math.max(0, ...Object.values(counts))
  if (top === 0) return null
  const winners = vote.options.filter((o) => counts[o.id] === top)
  return winners.length === 1 ? winners[0].id : null
}
