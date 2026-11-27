import { useId, useState, type FormEvent } from 'react'
import { Body, BottomActions, MainTabBar, Screen, Segmented, TopBar } from '../../components/layout'
import { Button, Chip, cx } from '../../components/ui'
import { formatHour, formatRange, timeOptions } from '../../lib/format'
import { currentUser, timetableActions, useAppState } from '../../store'
import { DAY_LABELS, type Day, type TimetableEntry } from '../../types'

const startOptions = timeOptions(9, 23.5).map(formatHour)
const endOptions = timeOptions(9, 24).map(formatHour)
const dayOptions = [...DAY_LABELS]

/** "10:30" → 10.5 */
function parseHour(text: string): number {
  const [h, m] = text.split(':').map(Number)
  return h + m / 60
}

type FormError = { reason: 'order' } | { reason: 'overlap'; conflict: TimetableEntry } | { reason: 'error'; message: string }

/** 내 시간표(직접 입력): 요일·시작·종료·구분을 골라 일정을 추가하고 목록에서 지운다 */
export function TimetableManualPage() {
  const s = useAppState()
  const me = currentUser(s)
  const entries = (me && s.timetables[me.id]) || []

  const [day, setDay] = useState<string>('월')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:00')
  const [kind, setKind] = useState<TimetableEntry['kind']>('class')
  const [error, setError] = useState<FormError | null>(null)
  const errorId = useId()

  /** 값이 바뀌면 이전 오류는 지운다 */
  const change = (apply: () => void) => {
    apply()
    setError(null)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const result = await timetableActions.add({
      day: DAY_LABELS.indexOf(day as (typeof DAY_LABELS)[number]) as Day,
      start: parseHour(start),
      end: parseHour(end),
      kind,
    })
    if (result.ok) setError(null)
    else if (result.reason === 'error') setError({ reason: 'error', message: result.message })
    else if (result.reason === 'order') setError({ reason: 'order' })
    // 서버가 겹친 일정을 알려 주지 않으면 겹쳤다는 사실만 보여 준다
    else setError(result.conflict ? { reason: 'overlap', conflict: result.conflict } : { reason: 'error', message: '이미 입력한 일정과 시간이 겹쳐요.' })
  }

  const message =
    error?.reason === 'order'
      ? '종료 시간은 시작 시간보다 늦어야 해요.'
      : error?.reason === 'overlap'
        ? `이미 입력한 ${formatRange(error.conflict.day, error.conflict.start, error.conflict.end)} 일정과 시간이 겹쳐요.`
        : error?.reason === 'error'
          ? error.message
          : null

  return (
    <Screen nav={<MainTabBar />}>
      <TopBar title="내 시간표" description="수업·알바 등 바쁜 시간만 입력하세요. 나머지는 공강으로 계산돼요." />
      <Body>
        <Segmented
          items={[
            { to: '/timetable', label: '표에서 선택', end: true },
            { to: '/timetable/manual', label: '직접 입력' },
          ]}
        />

        <section aria-labelledby="entries-title" className="flex flex-col gap-2">
          <h2 id="entries-title" className="m-0 text-base font-bold">
            입력한 일정 {entries.length}개
          </h2>
          {entries.length === 0 && <p className="m-0 text-sm text-muted">아직 입력한 일정이 없어요.</p>}
          {entries.map((en) => {
            const range = formatRange(en.day, en.start, en.end)
            return (
              <div key={en.id} className="flex min-h-14 items-center gap-3 rounded-control border border-line bg-surface pl-4 pr-1">
                <span className="text-[15px] font-medium">{range}</span>
                <Chip tone="neutral">{en.kind === 'class' ? '수업' : '활동 불가'}</Chip>
                <button
                  type="button"
                  aria-label={`${range} 삭제`}
                  onClick={() => timetableActions.remove(en.id)}
                  className="ml-auto min-h-11 min-w-11 rounded-control bg-transparent px-3 text-sm font-medium text-danger"
                >
                  삭제
                </button>
              </div>
            )
          })}
        </section>

        <form onSubmit={submit} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
          <h2 className="m-0 text-base font-bold">일정 추가</h2>
          <Select label="요일" value={day} options={dayOptions} onChange={(v) => change(() => setDay(v))} invalid={error?.reason === 'overlap'} />
          <div className="flex gap-3">
            <Select
              label="시작"
              value={start}
              options={startOptions}
              onChange={(v) => change(() => setStart(v))}
              invalid={error?.reason === 'overlap'}
              describedBy={message ? errorId : undefined}
            />
            <Select
              label="종료"
              value={end}
              options={endOptions}
              onChange={(v) => change(() => setEnd(v))}
              invalid={Boolean(error)}
              describedBy={message ? errorId : undefined}
            />
          </div>
          {message && (
            <span id={errorId} role="alert" className="text-[13px] font-medium text-danger">
              {message}
            </span>
          )}
          <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
            <legend className="mb-1.5 p-0 text-sm font-medium text-ink-2">구분</legend>
            <div className="flex gap-3">
              {(
                [
                  ['class', '수업'],
                  ['blocked', '활동 불가'],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex min-h-11 flex-1 items-center gap-2 rounded-control border border-line-strong px-3.5 text-base">
                  <input
                    type="radio"
                    name="kind"
                    value={value}
                    checked={kind === value}
                    onChange={() => setKind(value)}
                    className="size-5 accent-accent"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <Button type="submit">추가</Button>
        </form>
      </Body>
      <BottomActions>
        <Button to="/teams">저장하기</Button>
      </BottomActions>
    </Screen>
  )
}

/** 오류일 때 빨간 테두리를 입힐 수 있는 선택 상자(글자 오류는 폼 아래 한 곳에 따로 보여준다) */
function Select({
  label,
  value,
  options,
  onChange,
  invalid,
  describedBy,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
  invalid?: boolean
  describedBy?: string
}) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink-2">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cx(
          'min-h-12 w-full min-w-0 rounded-control bg-surface px-2.5 text-base text-ink',
          invalid ? 'border-2 border-danger' : 'border border-line-strong',
        )}
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  )
}
