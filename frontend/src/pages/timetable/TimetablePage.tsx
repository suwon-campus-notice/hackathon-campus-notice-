import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Body, BottomActions, MainTabBar, Screen, Segmented, TopBar } from '../../components/layout'
import { Button, cx } from '../../components/ui'
import { formatHour, timetableEndHour } from '../../lib/format'
import { freeSegments } from '../../lib/timetable'
import { currentUser, timetableActions, useAppState } from '../../store'
import { DAY_LABELS, type Day, type TimetableEntry } from '../../types'

/** 표가 시작하는 시각 */
const GRID_START = 9

type Kind = TimetableEntry['kind']
const KIND_LABEL: Record<Kind, string> = { class: '수업', blocked: '활동 불가' }

/** 선택 중인 범위: 같은 요일의 from ~ to 칸(순서 무관) */
interface Selection {
  day: Day
  from: number
  to: number
}

/**
 * 내 시간표: 요일×30분 표에서 바쁜 시간을 입력한다.
 * - 마우스: 눌러서 끌면 범위가 입력된다.
 * - 터치/키보드: 시작 칸을 누르고 끝 칸을 누르면 그 사이가 입력된다(화면 스크롤과 겹치지 않게).
 * - 이미 입력된 칸을 한 번 누르면 그 일정이 지워진다.
 */
export function TimetablePage() {
  const s = useAppState()
  const me = currentUser(s)
  const entries: TimetableEntry[] = (me && s.timetables[me.id]) || []

  const [kind, setKind] = useState<Kind>('class')
  const [drag, setDrag] = useState<Selection | null>(null)
  const [anchor, setAnchor] = useState<{ day: Day; slot: number } | null>(null)
  /** 마우스로 끈 직후 따라오는 click 을 무시하기 위한 표시 */
  const skipClick = useRef(false)

  const endHour = timetableEndHour(entries.map((e) => e.end))
  const expanded = endHour > 21
  const slotCount = (endHour - GRID_START) * 2
  const timeOf = (slot: number) => GRID_START + slot / 2

  /** 해당 요일·칸을 덮는 입력 일정 */
  const entryAt = (day: Day, slot: number) => entries.find((e) => e.day === day && timeOf(slot) >= e.start && timeOf(slot) < e.end)

  /** 범위를 입력한다. 이미 찬 칸은 건너뛰고 빈 구간만 채운다. */
  function fill(day: Day, a: number, b: number) {
    const segments = freeSegments(Math.min(a, b), Math.max(a, b), (slot) => Boolean(entryAt(day, slot)))
    for (const [from, to] of segments) {
      timetableActions.add({ day, start: timeOf(from), end: timeOf(to + 1), kind })
    }
  }

  /** 범위를 확정한다. 칸 하나이고 이미 찬 칸이면 그 일정을 지운다. */
  function commit(day: Day, a: number, b: number) {
    const hit = a === b ? entryAt(day, a) : undefined
    if (hit) timetableActions.remove(hit.id)
    else fill(day, a, b)
  }

  // 마우스를 놓으면 끌던 범위를 확정한다(표 밖에서 놓아도 처리)
  useEffect(() => {
    if (!drag) return
    const up = () => {
      commit(drag.day, drag.from, drag.to)
      // 끌기 직후 따라오는 click 만 무시한다. 표 밖에서 놓아 click 이 없으면 곧 해제한다.
      skipClick.current = true
      window.setTimeout(() => {
        skipClick.current = false
      }, 50)
      setDrag(null)
    }
    window.addEventListener('pointerup', up, { once: true })
    return () => window.removeEventListener('pointerup', up)
    // eslint-disable-next-line
  }, [drag])

  /** 터치·키보드: 첫 번째 누름은 시작, 두 번째 누름은 끝 */
  function tap(day: Day, slot: number) {
    if (skipClick.current) {
      skipClick.current = false
      return
    }
    const hit = entryAt(day, slot)
    if (!anchor && hit) return timetableActions.remove(hit.id)
    if (!anchor || anchor.day !== day) return setAnchor({ day, slot })
    commit(day, anchor.slot, slot)
    setAnchor(null)
  }

  const preview = drag ?? (anchor ? { day: anchor.day, from: anchor.slot, to: anchor.slot } : null)
  const inPreview = (day: Day, slot: number) =>
    preview !== null && preview.day === day && slot >= Math.min(preview.from, preview.to) && slot <= Math.max(preview.from, preview.to)

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

        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="pb-1.5 text-[13px] font-medium text-ink-2">구분</legend>
          <div className="flex gap-2">
            {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
              <label
                key={k}
                className={cx(
                  'flex min-h-11 flex-1 items-center gap-2 rounded-control px-3 text-sm',
                  kind === k ? 'border-2 border-accent bg-accent-soft font-bold' : 'border border-line-strong bg-surface font-medium',
                )}
              >
                <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} className="size-5 accent-accent" />
                <span aria-hidden="true" className={cx('size-3 rounded-[3px]', k === 'blocked' ? 'striped-blocked' : 'bg-busy')} />
                {KIND_LABEL[k]}
              </label>
            ))}
          </div>
        </fieldset>

        <div role="group" aria-label="시간표" className="select-none overflow-hidden rounded-card border border-line bg-surface">
          <div className="grid grid-cols-[28px_repeat(7,minmax(0,1fr))]">
            <div />
            {DAY_LABELS.map((d) => (
              <div key={d} className="py-2 text-center text-[13px] font-medium text-ink-2">
                {d}
              </div>
            ))}
            {Array.from({ length: slotCount }, (_, i) => {
              const onHour = i % 2 === 0
              return (
                <Row key={i} label={onHour ? String(timeOf(i)) : ''} onHour={onHour}>
                  {([0, 1, 2, 3, 4, 5, 6] as Day[]).map((day) => {
                    const hit = entryAt(day, i)
                    const above = i > 0 ? entryAt(day, i - 1) : undefined
                    const selecting = inPreview(day, i)
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-label={`${DAY_LABELS[day]} ${formatHour(timeOf(i))} ${hit ? KIND_LABEL[hit.kind] : '비어 있음'}${selecting ? ' 선택 중' : ''}`}
                        onPointerDown={(e) => {
                          if (e.pointerType === 'touch') return
                          setAnchor(null)
                          setDrag({ day, from: i, to: i })
                        }}
                        onPointerEnter={() => {
                          if (drag && drag.day === day) setDrag({ ...drag, to: i })
                        }}
                        onClick={() => tap(day, i)}
                        className={cx(
                          'h-7 border-l border-line p-0',
                          onHour ? 'border-t border-t-line-strong' : 'border-t border-t-line',
                          selecting ? 'bg-accent-light' : hit ? (hit.kind === 'blocked' ? 'striped-blocked' : 'bg-busy') : 'bg-surface',
                          hit && !selecting && above?.id === hit.id && 'border-t-transparent',
                        )}
                      />
                    )
                  })}
                </Row>
              )
            })}
          </div>
          <p className="m-0 border-t border-line px-3 py-2.5 text-center text-xs text-muted">
            {expanded ? '입력한 일정에 맞춰 24시까지 칸이 늘어나요' : '21시 이후 일정을 입력하면 칸이 늘어나요'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-3 rounded-[3px] bg-busy" />
            수업
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-3 rounded-[3px] striped-blocked" />
            활동 불가
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-3 rounded-[3px] border border-line-strong bg-surface" />
            비어 있음
          </span>
          <span className="ml-auto text-muted">30분 단위</span>
        </div>
        <p className="m-0 text-xs leading-relaxed text-muted" aria-live="polite">
          {anchor
            ? `${DAY_LABELS[anchor.day]} ${formatHour(timeOf(anchor.slot))} 부터예요. 끝나는 칸을 눌러 주세요.`
            : '시작 칸을 누르고 끝 칸을 누르면 그 사이가 입력돼요. 마우스는 끌어서 입력할 수 있어요. 이미 입력한 칸을 누르면 그 일정이 지워져요. 정확한 시간은 '}
          {!anchor && (
            <Link to="/timetable/manual" className="text-accent">
              직접 입력
            </Link>
          )}
          {!anchor && '으로 넣어 주세요.'}
        </p>
      </Body>
      <BottomActions>
        <Button to="/teams">저장하기</Button>
      </BottomActions>
    </Screen>
  )
}

/** 한 줄(30분): 정시에만 시각 글자를 보여준다. grid 안에서 자식들이 그대로 칸이 되도록 fragment 로 묶는다. */
function Row({ label, onHour, children }: { label: string; onHour: boolean; children: ReactNode }) {
  return (
    <>
      <div
        aria-hidden="true"
        className={cx('pr-1 text-right text-[11px] leading-none text-muted', onHour && 'border-t border-t-line-strong pt-1')}
      >
        {label}
      </div>
      {children}
    </>
  )
}
