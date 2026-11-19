import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Body, BottomActions, Screen, TopBar } from '../../components/layout'
import { Button, Chip, Notice } from '../../components/ui'
import { majority, tally } from '../../lib/vote'
import { getState, scheduleActions, userName } from '../../store'
import { optionLabel, useMemberTeam } from './scheduleHelpers'
import { VoteOptionCard } from './VoteOptionCard'

/** 회의 시간 투표: 복수 선택 → 투표 후에는 내 선택을 파랗게 표시, 수정 가능 */
export function VotePage() {
  const { s, team, me, leader } = useMemberTeam()
  const [editing, setEditing] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  /** 동률로 재투표가 시작될 때 직전 득표 수를 기억한다 (스토어에는 남지 않는다) */
  const [prevTie, setPrevTie] = useState<Record<string, number> | null>(null)
  if (!team || !me) return <Navigate to="/teams" replace />

  const vote = s.votes[team.id]
  // 투표가 없거나 마감됐거나(확정·취소 포함) 하면 일정 탭으로 돌아간다
  if (!vote || vote.ended) return <Navigate to={`/teams/${team.id}/schedule`} replace />

  const teamSize = team.memberIds.length
  const need = majority(teamSize)
  const counts = tally(vote)
  const myBallot = vote.ballots[me.id] ?? []
  const hasVoted = myBallot.length > 0
  const choosing = !hasVoted || editing
  const canCancel = vote.createdBy === me.id || leader

  const subtitle = vote.revote
    ? '표가 같은 시간이 있어서 다시 투표해요.'
    : choosing
      ? '가능한 시간을 모두 골라주세요.'
      : '투표했어요. 내가 고른 시간은 파랗게 표시돼요.'

  const toggle = (id: string, checked: boolean) => setPicked((p) => (checked ? [...p, id] : p.filter((x) => x !== id)))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (picked.length === 0) return
    // 이 표로 동률이 되면 스토어가 표를 비우므로, 직전 득표 수를 먼저 계산해 둔다
    const next = { ...vote, ballots: { ...vote.ballots, [me.id]: picked } }
    const nextCounts = tally(next)
    scheduleActions.castVote(team.id, picked)
    if (getState().votes[team.id]?.revote && !vote.revote) setPrevTie(nextCounts)
    setEditing(false)
    setPicked([])
  }

  const tieOptions = vote.options.map((o) => (prevTie ? `${optionLabel(o)} ${prevTie[o.id] ?? 0}명` : optionLabel(o)))

  return (
    <Screen>
      <TopBar
        title={vote.revote ? '재투표' : '회의 시간 투표'}
        back={{ to: `/teams/${team.id}/schedule` }}
        description={subtitle}
        badge={<Chip>마감까지 {vote.hoursLeft}시간</Chip>}
      />
      <form onSubmit={submit} className="flex flex-1 flex-col">
        <Body>
          {vote.revote && (
            <Notice>
              <strong className="block">이전 투표 결과</strong>
              {tieOptions.join(' · ')}
            </Notice>
          )}
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
              emptyText="아직 없어요"
              check={choosing ? { checked: picked.includes(o.id), onChange: (c) => toggle(o.id, c) } : undefined}
              mine={!choosing && myBallot.includes(o.id)}
            />
          ))}
        </Body>
        <BottomActions>
          {choosing ? (
            <>
              <Button type="submit" disabled={picked.length === 0}>
                투표 완료
              </Button>
              <p className="m-0 text-center text-xs text-muted">회의는 시작 시간만 정해요</p>
            </>
          ) : (
            <Button
              variant="secondary"
              onClick={() => {
                setPicked(myBallot)
                setEditing(true)
              }}
            >
              수정
            </Button>
          )}
          {canCancel && (
            <Link
              to={`/teams/${team.id}/vote/cancel`}
              className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-danger no-underline"
            >
              투표 취소
            </Link>
          )}
        </BottomActions>
      </form>
    </Screen>
  )
}
