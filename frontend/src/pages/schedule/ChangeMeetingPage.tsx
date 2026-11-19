import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Body, BottomActions, Screen, TopBar } from '../../components/layout'
import { Button, Chip, cx } from '../../components/ui'
import { formatHour } from '../../lib/format'
import { scheduleActions } from '../../store'
import { DAY_LABELS, type Day } from '../../types'
import { optionLabel, useMemberTeam } from './scheduleHelpers'
import { teamAvailability } from './teamAvailability'

/** 확정된 회의 시간 변경: 팀장만 */
export function ChangeMeetingPage() {
  const { s, team, me, leader } = useMemberTeam()
  const navigate = useNavigate()
  const [choice, setChoice] = useState<string | null>(null)
  if (!team || !me) return <Navigate to="/teams" replace />

  const schedule = `/teams/${team.id}/schedule`
  const meeting = s.meetings[team.id]
  if (!leader || !meeting) return <Navigate to={schedule} replace />

  const { availability } = teamAvailability(s, team)
  const key = (day: Day, start: number) => `${day}-${start}`
  const currentKey = key(meeting.day, meeting.start)
  const selected = choice ?? currentKey

  const choices = [
    { key: currentKey, day: meeting.day, start: meeting.start, note: '현재' },
    ...availability.picks
      .filter((p) => key(p.day, p.start) !== currentKey)
      .map((p) => ({
        key: key(p.day, p.start),
        day: p.day,
        start: p.start,
        note: p.people === availability.total ? '전원 가능' : `${p.people}명 가능`,
      })),
  ]

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const c = choices.find((x) => x.key === selected)
    if (c && c.key !== currentKey) scheduleActions.changeMeeting(team.id, c.day, c.start)
    navigate(schedule, { replace: true })
  }

  return (
    <Screen>
      <TopBar
        title="회의 시간 변경"
        back={{ to: `/teams/${team.id}/schedule` }}
        description={`팀장만 바꿀 수 있어요. 현재는 ${DAY_LABELS[meeting.day]}요일 ${formatHour(meeting.start)} 시작이에요.`}
      />
      <form onSubmit={submit} className="flex flex-1 flex-col">
        <Body>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 p-0 text-base font-bold">새 시작 시간</legend>
            {choices.map((c) => (
              <label
                key={c.key}
                className={cx(
                  'flex min-h-14 cursor-pointer items-center gap-3 rounded-control px-4',
                  selected === c.key ? 'border-2 border-accent bg-accent-soft' : 'border border-line bg-surface',
                )}
              >
                <input
                  type="radio"
                  name="time"
                  checked={selected === c.key}
                  onChange={() => setChoice(c.key)}
                  className="size-5 accent-accent"
                />
                <span className="flex-1 text-base font-bold">{optionLabel(c)}</span>
                <Chip tone={c.note === '현재' ? 'solid' : 'accent'}>{c.note}</Chip>
              </label>
            ))}
          </fieldset>
        </Body>
        <BottomActions>
          <Button type="submit">변경하기</Button>
          <Link to={schedule} className="inline-flex min-h-12 items-center justify-center text-base font-medium text-ink-2 no-underline">
            취소
          </Link>
        </BottomActions>
      </form>
    </Screen>
  )
}
