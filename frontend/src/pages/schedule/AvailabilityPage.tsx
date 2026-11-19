import { Navigate, useNavigate } from 'react-router-dom'
import { Body, BottomActions, Screen, TopBar } from '../../components/layout'
import { Button, Card, Chip, cx, Notice } from '../../components/ui'
import { WINDOW_END, WINDOW_START } from '../../lib/availability'
import { formatHour } from '../../lib/format'
import { scheduleActions } from '../../store'
import { DAY_LABELS } from '../../types'
import { useMemberTeam } from './scheduleHelpers'
import { teamAvailability } from './teamAvailability'

const SPAN = WINDOW_END - WINDOW_START
const pct = (h: number) => `${((h - WINDOW_START) / SPAN) * 100}%`

/** 공통 가능 시간: 추천 시간, 요일별 막대, 격자, 투표 올리기 */
export function AvailabilityPage() {
  const { s, team, me } = useMemberTeam()
  const navigate = useNavigate()
  if (!team || !me) return <Navigate to="/teams" replace />

  const base = `/teams/${team.id}`
  const { availability, notEntered, entered } = teamAvailability(s, team)
  const { total, days, picks } = availability
  const hasVote = Boolean(s.votes[team.id])
  const canCreate = !hasVote && picks.length > 0
  const peopleLabel = (n: number) => (n === total ? '전원' : `${n}명`)

  const createVote = () => {
    if (scheduleActions.createVote(team.id, picks.map((p) => ({ day: p.day, start: p.start })))) {
      navigate(`${base}/vote`)
    }
  }

  return (
    <Screen>
      <TopBar
        title="공통 가능 시간"
        back={{ to: `${base}/schedule` }}
        description="전원이 가능한 시간을 먼저 보여주고, 없는 요일은 가장 많은 인원이 가능한 시간을 보여줘요."
      />
      <Body className="pb-4">
        {notEntered.length > 0 && entered > 0 && (
          <Notice>
            <strong>{notEntered.join(' · ')}</strong>님이 아직 시간표를 입력하지 않았어요. 입력한 {entered}명 기준으로 보여드려요.
          </Notice>
        )}

        {entered === 0 ? (
          <Notice tone="neutral">아직 시간표를 입력한 팀원이 없어요. 팀원이 시간표를 입력하면 공통 가능 시간이 보여요.</Notice>
        ) : (
          <>
            <section aria-labelledby="picks-title" className="flex flex-col gap-2">
              <h2 id="picks-title" className="m-0 text-base font-bold">
                추천 시간
              </h2>
              {picks.length === 0 && <p className="m-0 text-sm text-muted">1시간 이상 함께 가능한 시간이 없어요.</p>}
              {picks.map((p) => (
                <div key={`${p.day}-${p.start}`} className="flex min-h-14 items-center gap-3 rounded-control border border-line bg-surface px-4">
                  <span className="text-base font-bold">{p.label}</span>
                  <span className="ml-auto">
                    <Chip tone="accent">
                      {peopleLabel(p.people)} · {p.end - p.start}시간
                    </Chip>
                  </span>
                </div>
              ))}
            </section>

            <section aria-labelledby="days-title" className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h2 id="days-title" className="m-0 text-base font-bold">
                  요일별로 보기
                </h2>
                <div className="flex gap-3 text-xs text-ink-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-3 rounded-[3px] bg-accent" />
                    전원
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-3 rounded-[3px] bg-accent-light" />
                    가장 많은 인원
                  </span>
                </div>
              </div>
              <div aria-hidden="true" className="flex justify-between pl-7 pr-10 text-[11px] text-muted">
                {[9, 12, 15, 18, 21].map((h) => (
                  <span key={h}>{h}시</span>
                ))}
              </div>
              {days.map((d) => (
                <div key={d.day} className="flex h-6 items-center gap-2">
                  <span className="w-5 text-[13px] font-medium text-ink-2">{DAY_LABELS[d.day]}</span>
                  <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-soft">
                    {d.ranges.map((r) => (
                      <div
                        key={r.start}
                        className={cx('absolute top-0 h-5', d.people === total ? 'bg-accent' : 'bg-accent-light')}
                        style={{ left: pct(r.start), width: `${((r.end - r.start) / SPAN) * 100}%` }}
                      />
                    ))}
                  </div>
                  <span className="w-8 text-right text-xs text-ink-2">{d.ranges.length ? peopleLabel(d.people) : '없음'}</span>
                </div>
              ))}
            </section>

            <Card className="p-0">
              <details className="group">
                <summary className="flex min-h-12 cursor-pointer items-center px-4 text-[15px] font-medium">시간표 격자로 자세히 보기</summary>
                <div className="px-3 pb-3" role="group" aria-label="시간표 격자">
                  <div className="grid grid-cols-[24px_repeat(7,minmax(0,1fr))]">
                    <div />
                    {DAY_LABELS.map((d) => (
                      <div key={d} className="py-1 text-center text-xs font-medium text-ink-2">
                        {d}
                      </div>
                    ))}
                    {Array.from({ length: SPAN * 2 }, (_, i) => (
                      <GridRow key={i} i={i} cells={days.map((d) => d.slots[i])} total={total} />
                    ))}
                  </div>
                  <p className="m-0 mt-2 text-xs text-muted">진한 파랑은 전원 가능, 연한 파랑은 1명만 어려운 시간이에요.</p>
                </div>
              </details>
            </Card>
          </>
        )}
      </Body>
      <BottomActions>
        {hasVote && <p className="m-0 text-center text-sm text-muted">진행 중인 투표가 있어요</p>}
        <Button disabled={!canCreate} onClick={createVote}>
          이 시간들로 투표 올리기
        </Button>
      </BottomActions>
    </Screen>
  )
}

function GridRow({ i, cells, total }: { i: number; cells: number[]; total: number }) {
  const t = WINDOW_START + i / 2
  return (
    <>
      <div aria-hidden="true" className="pr-1 pt-0.5 text-right text-[10px] leading-none text-muted">
        {i % 2 === 0 ? t : ''}
      </div>
      {cells.map((count, d) => (
        <div
          key={d}
          title={`${DAY_LABELS[d]} ${formatHour(t)} ${count}명 가능`}
          className={cx(
            'h-4 border-l border-t border-line',
            i % 2 === 0 ? 'border-t-line-strong' : 'border-t-line',
            count === total ? 'bg-accent' : count === total - 1 && total > 1 ? 'bg-accent-light' : 'bg-surface',
          )}
        />
      ))}
    </>
  )
}
