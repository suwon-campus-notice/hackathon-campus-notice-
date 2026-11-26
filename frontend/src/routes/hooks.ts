import { useParams } from 'react-router-dom'
import { currentUser, isLeader, teamById, useAppState } from '../store'

/** 주소의 :teamId 에 해당하는 팀과, 내가 팀장인지 같은 정보를 한 번에 돌려준다. */
export function useTeamContext() {
  const { teamId = '' } = useParams()
  const s = useAppState()
  const team = teamById(s, teamId)
  return {
    s,
    teamId,
    team,
    me: currentUser(s),
    leader: team ? isLeader(s, team.id) : false,
  }
}
