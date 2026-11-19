import { Link, Navigate } from 'react-router-dom'
import { Body, Screen, TeamTabBar, TopBar } from '../../components/layout'
import { Button, Card, Chip, type ChipTone } from '../../components/ui'
import { DAY_LABELS, TODO_STATUS_LABELS, type TodoStatus } from '../../types'
import { formatDue, formatHour } from '../../lib/format'
import { userName } from '../../store'
import { useTeamContext } from '../../routes/hooks'
import { Avatar } from './InviteLink'

const STATUS_TONE: Record<TodoStatus, ChipTone> = { doing: 'accent', requested: 'warn', done: 'solid' }

export function TeamHomePage() {
  const { s, team, me, leader } = useTeamContext()
  if (!team || !me || !team.memberIds.includes(me.id)) return <Navigate to="/teams" replace />

  const base = `/teams/${team.id}`
  const vote = s.votes[team.id]
  const meeting = s.meetings[team.id]
  const myTodos = s.todos.filter((t) => t.teamId === team.id && t.assigneeId === me.id)

  return (
    <Screen nav={<TeamTabBar teamId={team.id} />}>
      <TopBar title={team.name} back={{ to: '/teams', always: true }} badge={leader ? <Chip tone="solid">팀장</Chip> : undefined} />
      <Body>
        <section className="flex flex-col gap-2">
          <h2 className="m-0 text-base font-bold">회의</h2>
          {vote && !vote.ended ? (
            <Card className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="flex-1 font-bold">회의 시간 투표 중</span>
                <Chip tone="warn">{vote.hoursLeft}시간 남음</Chip>
              </div>
              <p className="m-0 text-sm text-ink-2">
                {vote.ballots[me.id] ? '투표했어요.' : '아직 투표하지 않았어요. 가능한 시간을 골라주세요.'}
              </p>
              <Button to={`${base}/vote`}>투표하기</Button>
            </Card>
          ) : vote ? (
            <Link to={`${base}/schedule`} className="flex flex-col gap-1 rounded-card bg-warn-soft p-4 text-warn-deep no-underline">
              <span className="font-bold">투표가 끝났어요</span>
            </Link>
          ) : meeting ? (
            <Link to={`${base}/schedule`} className="flex flex-col gap-1 rounded-card bg-accent p-4 text-white no-underline">
              <span className="text-sm">확정된 회의 시간</span>
              <span className="text-lg font-bold">
                {DAY_LABELS[meeting.day]}요일 {formatHour(meeting.start)} 시작
              </span>
            </Link>
          ) : (
            <Link to={`${base}/schedule`} className="flex flex-col gap-1 rounded-card border border-line bg-surface p-4 text-ink no-underline">
              <span className="font-bold">진행 중인 투표가 없어요</span>
              <span className="text-sm text-accent-ink">일정 탭에서 투표를 만들 수 있어요</span>
            </Link>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="m-0 text-base font-bold">내 할 일</h2>
          {myTodos.length === 0 ? (
            <p className="m-0 text-sm text-muted">할 일이 없어요</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {myTodos.map((t) => (
                <li key={t.id}>
                  <Link
                    to={`${base}/todos/${t.id}`}
                    className="flex min-h-12 items-center gap-2 rounded-card border border-line bg-surface p-3 text-ink no-underline"
                  >
                    <span className="flex flex-1 flex-col">
                      <span className="font-medium">{t.title}</span>
                      <span className="text-xs text-muted">마감 {formatDue(t.due)}</span>
                    </span>
                    <Chip tone={STATUS_TONE[t.status]}>{TODO_STATUS_LABELS[t.status]}</Chip>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-2 pb-4">
          <h2 className="m-0 text-base font-bold">팀원 {team.memberIds.length}명</h2>
          <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
            {team.memberIds.map((id) => (
              <li key={id} className="flex items-center gap-2">
                <Avatar name={userName(s, id)} solid={id === team.leaderId} />
                <span className="text-sm">{userName(s, id)}</span>
              </li>
            ))}
          </ul>
        </section>
      </Body>
    </Screen>
  )
}
