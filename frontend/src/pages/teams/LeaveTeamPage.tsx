import { Navigate, useNavigate } from 'react-router-dom'
import { Body, BottomActions, Screen, TopBar } from '../../components/layout'
import { Button, Notice } from '../../components/ui'
import { teamActions } from '../../store'
import { useTeamContext } from '../../routes/hooks'

export function LeaveTeamPage() {
  const { team, me, leader } = useTeamContext()
  const navigate = useNavigate()
  if (!team || !me || !team.memberIds.includes(me.id)) return <Navigate to="/teams" replace />

  async function leave() {
    if (team && (await teamActions.leave(team.id))) navigate('/teams')
  }

  return (
    <Screen>
      <TopBar
        title="팀에서 나갈까요?"
        back={{ to: `/teams/${team.id}/members` }}
        description={
          <>
            <strong className="font-bold text-ink">{team.name}</strong>에서 나가면 이 팀의 일정과 할 일을 볼 수 없어요. 다시 들어오려면 초대
            링크가 필요해요.
          </>
        }
      />
      {leader && (
        <Body>
          <div role="alert">
            <Notice>팀장은 팀장을 먼저 넘겨야 탈퇴할 수 있어요.</Notice>
          </div>
        </Body>
      )}
      <BottomActions>
        <Button variant="dangerSolid" onClick={leave} disabled={leader}>
          팀 탈퇴
        </Button>
        <Button to={`/teams/${team.id}/members`} variant="ghost">
          취소
        </Button>
      </BottomActions>
    </Screen>
  )
}
