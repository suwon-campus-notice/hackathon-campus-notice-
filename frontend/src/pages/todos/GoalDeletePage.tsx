import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { BottomActions, Screen, TopBar } from '../../components/layout'
import { Button } from '../../components/ui'
import { todoActions } from '../../store'
import { useTeamContext } from '../../routes/hooks'

export function GoalDeletePage() {
  const { s, team, teamId, me, leader } = useTeamContext()
  const { goalId = '' } = useParams()
  const navigate = useNavigate()
  const back = `/teams/${teamId}/todos`
  if (!team || !me || !team.memberIds.includes(me.id)) return <Navigate to="/teams" replace />
  const goal = s.goals.find((g) => g.id === goalId && g.teamId === teamId)
  if (!leader || !goal) return <Navigate to={back} replace />
  const count = s.todos.filter((t) => t.goalId === goal.id).length

  return (
    <Screen>
      <TopBar
        title="목표를 삭제할까요?"
        back={{ to: `${back}/goals/${goal.id}/edit` }}
        description={
          <>
            <strong className="text-ink">{goal.title}</strong>와 안에 있는 개인 목표 {count}개가 모두 삭제돼요. 삭제한 뒤에는 되돌릴 수 없어요.
          </>
        }
      />
      <div className="flex-1" />
      <BottomActions>
        <Button
          variant="dangerSolid"
          onClick={async () => {
            await todoActions.deleteGoal(goal.id)
            navigate(back, { replace: true })
          }}
        >
          삭제
        </Button>
        <Button to={`${back}/goals/${goal.id}/edit`} variant="secondary">
          취소
        </Button>
      </BottomActions>
    </Screen>
  )
}
