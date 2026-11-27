import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { currentUser, isLeader, refreshTeams, teamById, useAppState } from '../store'

/** 주소의 :teamId 에 해당하는 팀과, 내가 팀장인지 같은 정보를 한 번에 돌려준다. */
export function useTeamContext() {
  const { teamId = '' } = useParams()
  const s = useAppState()
  // 서버 모드: 팀 화면에 들어올 때마다 투표·회의·할 일을 최신으로 불러온다
  useEffect(() => {
    if (teamId) void refreshTeams([teamId])
  }, [teamId])
  const team = teamById(s, teamId)
  return {
    s,
    teamId,
    team,
    me: currentUser(s),
    leader: team ? isLeader(s, team.id) : false,
  }
}
