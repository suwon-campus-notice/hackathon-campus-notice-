import { Navigate, useNavigate } from 'react-router-dom'
import { Body, BottomActions, Screen, TopBar } from '../../components/layout'
import { Button } from '../../components/ui'
import { scheduleActions } from '../../store'
import { useMemberTeam } from './scheduleHelpers'

/** 투표 취소 확인: 만든 사람이나 팀장만 */
export function VoteCancelPage() {
  const { s, team, me, leader } = useMemberTeam()
  const navigate = useNavigate()
  if (!team || !me) return <Navigate to="/teams" replace />

  const schedule = `/teams/${team.id}/schedule`
  const vote = s.votes[team.id]
  if (!vote || (vote.createdBy !== me.id && !leader)) return <Navigate to={schedule} replace />

  return (
    <Screen>
      <TopBar title="투표를 취소할까요?" back={{ to: `/teams/${team.id}/vote` }} description="지금까지 받은 표가 모두 사라지고 되돌릴 수 없어요. 새 투표는 다시 만들 수 있어요." />
      <Body>{null}</Body>
      <BottomActions>
        <Button
          variant="dangerSolid"
          onClick={() => {
            scheduleActions.cancelVote(team.id)
            navigate(schedule, { replace: true })
          }}
        >
          투표 취소
        </Button>
        <Button variant="ghost" to={`/teams/${team.id}/vote`}>
          돌아가기
        </Button>
      </BottomActions>
    </Screen>
  )
}
