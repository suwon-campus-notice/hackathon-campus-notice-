import { formatHour } from '../../lib/format'
import { useTeamContext } from '../../routes/hooks'
import { DAY_LABELS, type VoteOption } from '../../types'

/** 팀 정보. 팀이 없거나 내가 팀원이 아니면 team 이 undefined 다. */
export function useMemberTeam() {
  const ctx = useTeamContext()
  const member = Boolean(ctx.team && ctx.me && ctx.team.memberIds.includes(ctx.me.id))
  return { ...ctx, team: member ? ctx.team : undefined }
}

/** "수 15:00 시작" */
export function optionLabel(o: Pick<VoteOption, 'day' | 'start'>): string {
  return `${DAY_LABELS[o.day]} ${formatHour(o.start)} 시작`
}
