import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Body, MainTabBar, Screen, TopBar } from '../../components/layout'
import { Button, Chip, TextField } from '../../components/ui'
import { DAY_LABELS, type Team } from '../../types'
import { formatHour } from '../../lib/format'
import { myTeams, refreshTeams, useAppState, visibleTodos, type State } from '../../store'

/** 팀 카드에 붙일 상태 칩들 */
function statusChips(s: State, team: Team) {
  const chips: Array<{ tone: 'warn' | 'accent'; text: string }> = []
  const vote = s.votes[team.id]
  if (vote && !vote.ended && !(s.currentUserId && vote.ballots[s.currentUserId])) {
    chips.push({ tone: 'warn', text: `투표 필요 · ${vote.hoursLeft}시간 남음` })
  }
  const meeting = s.meetings[team.id]
  if (meeting) {
    chips.push({ tone: 'accent', text: `다음 회의 ${DAY_LABELS[meeting.day]} ${formatHour(meeting.start)}` })
  }
  const mine = visibleTodos(s, team.id).filter((t) => t.assigneeId === s.currentUserId && t.status !== 'done').length
  if (mine > 0) chips.push({ tone: 'accent', text: `할 일 ${mine}개` })
  return chips
}

export function TeamListPage() {
  const s = useAppState()
  const navigate = useNavigate()
  const teams = myTeams(s)
  const [joining, setJoining] = useState(false)
  const [code, setCode] = useState('')
  const teamIds = teams.map((t) => t.id).join(',')
  // 서버 모드: 목록에 들어올 때마다 각 팀의 투표·할 일 현황을 최신으로 불러온다
  useEffect(() => {
    void refreshTeams(teamIds ? teamIds.split(',') : [])
  }, [teamIds])

  function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = code.trim()
    if (trimmed) navigate(`/join/${encodeURIComponent(trimmed)}`)
  }

  return (
    <Screen nav={<MainTabBar />}>
      <TopBar title="내 팀" description={teams.length > 0 ? '팀을 고르면 그 팀의 일정과 할 일을 볼 수 있어요.' : undefined} />
      <Body>
        {teams.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {teams.map((team) => {
              const chips = statusChips(s, team)
              const leader = team.leaderId === s.currentUserId
              return (
                <li key={team.id}>
                  <Link
                    to={`/teams/${team.id}`}
                    className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4 text-ink no-underline"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-base font-bold">{team.name}</span>
                      <Chip tone={leader ? 'solid' : 'neutral'}>{leader ? '팀장' : '팀원'}</Chip>
                    </div>
                    <div className="text-sm text-muted">팀원 {team.memberIds.length}명</div>
                    <div className="flex flex-wrap gap-1.5">
                      {chips.length > 0 ? (
                        chips.map((c) => (
                          <Chip key={c.text} tone={c.tone}>
                            {c.text}
                          </Chip>
                        ))
                      ) : (
                        <Chip>새 소식 없음</Chip>
                      )}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        <div className="flex flex-col gap-2">
          <Button to="/teams/new">팀 만들기</Button>
          {joining ? (
            <form onSubmit={submit} className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4">
              <TextField label="초대 코드" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoFocus />
              <Button type="submit" disabled={!code.trim()}>
                참여
              </Button>
            </form>
          ) : (
            <Button variant="secondary" onClick={() => setJoining(true)}>
              초대 링크로 참여
            </Button>
          )}
        </div>
      </Body>
    </Screen>
  )
}
