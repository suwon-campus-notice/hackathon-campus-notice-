import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Body, Screen, TeamTabBar, TopBar } from '../../components/layout'
import { Button, Card, Chip, Notice } from '../../components/ui'
import { formatHour } from '../../lib/format'
import { majority, singleTopOption, tally } from '../../lib/vote'
import { scheduleActions, userName } from '../../store'
import { DAY_LABELS } from '../../types'
import { optionLabel, useMemberTeam } from './scheduleHelpers'
import { VoteOptionCard } from './VoteOptionCard'

/** 팀 일정 탭: 투표 진행 / 마감 / 확정 / 없음 상태를 보여준다 */
export function SchedulePage() {
  const { s, team, me, leader } = useMemberTeam()
  const navigate = useNavigate()
  if (!team || !me) return <Navigate to="/teams" replace />

  const vote = s.votes[team.id]
  const meeting = s.meetings[team.id]
  const base = `/teams/${team.id}`
  const teamSize = team.memberIds.length
  const need = majority(teamSize)

  /** 과반을 못 넘기고 끝난 투표: 결과와 팀장 조치 */
  const renderEnded = () => {
    if (!vote || !team) return null
    const counts = tally(vote)
    const top = singleTopOption(vote)
    const topOption = vote.options.find((o) => o.id === top)
    return (
      <>
        <Notice>
          <strong className="block">투표가 끝났어요</strong>
          과반({need}명)을 넘은 시간이 없어요. 팀장이 정해 주세요.
        </Notice>
        {vote.options.map((o) => (
          <VoteOptionCard
            key={o.id}
            label={optionLabel(o)}
            count={counts[o.id]}
            teamSize={teamSize}
            need={need}
            voters={Object.entries(vote.ballots)
              .filter(([, ids]) => ids.includes(o.id))
              .map(([uid]) => userName(s, uid))}
            emptyText="아무도 고르지 않았어요"
          />
        ))}
        {leader ? (
          <div className="flex flex-col gap-2">
            {topOption && (
              <Button onClick={() => scheduleActions.confirmEnded(team.id)}>{optionLabel(topOption)}으로 확정</Button>
            )}
            <Button
              variant="secondary"
              onClick={async () => {
                await scheduleActions.restartVote(team.id)
                navigate(`/teams/${team.id}/availability`)
              }}
            >
              다시 투표
            </Button>
          </div>
        ) : (
          <p className="m-0 text-sm text-muted">팀장이 시간을 확정하거나 다시 투표를 시작할 수 있어요.</p>
        )}
      </>
    )
  }

  return (
    <Screen nav={<TeamTabBar teamId={team.id} />}>
      <TopBar title="일정" back={{ to: base, always: true }} />
      <Body>
        {vote && !vote.ended && (
          <Card className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="flex-1 text-base font-bold">회의 시간 투표 중</span>
              <Chip tone="warn">{vote.hoursLeft}시간 남음</Chip>
            </div>
            <p className="m-0 text-sm text-muted">
              {(vote.ballots[me.id] ?? []).length > 0 ? '투표했어요.' : '아직 투표하지 않았어요. 가능한 시간을 골라주세요.'}
            </p>
            <Button to={`${base}/vote`}>투표하기</Button>
            {leader && (
              <details className="text-xs text-muted">
                <summary className="min-h-8 cursor-pointer">시연용</summary>
                <button
                  type="button"
                  onClick={() => scheduleActions.endVote(team.id)}
                  className="min-h-11 bg-transparent p-0 text-xs text-muted underline"
                >
                  (시연) 24시간 지난 것으로 만들기
                </button>
              </details>
            )}
          </Card>
        )}

        {vote?.ended && renderEnded()}

        {!vote && meeting && (
          <Card tone="solid" className="flex flex-col gap-1">
            <span className="text-sm opacity-90">확정된 회의 시간</span>
            <span className="text-2xl font-bold">
              {DAY_LABELS[meeting.day]}요일 {formatHour(meeting.start)} 시작
            </span>
            <span className="text-sm opacity-90">
              {teamSize}명 중 {meeting.votes}명이 선택했어요
            </span>
          </Card>
        )}
        {!vote && meeting && leader && (
          <Button variant="secondary" to={`${base}/meeting/change`}>
            시간 변경
          </Button>
        )}

        {!vote && !meeting && (
          <Card className="flex flex-col gap-3">
            <p className="m-0 text-base font-bold">진행 중인 투표가 없어요</p>
            <Button to={`${base}/availability`}>투표 만들기</Button>
          </Card>
        )}

        <Link
          to={`${base}/availability`}
          className="flex min-h-[52px] items-center justify-between rounded-control border border-line bg-surface px-4 text-[15px] font-medium text-ink no-underline"
        >
          <span>공통 가능 시간 보기</span>
          <span aria-hidden="true" className="text-muted">
            ›
          </span>
        </Link>
      </Body>
    </Screen>
  )
}
