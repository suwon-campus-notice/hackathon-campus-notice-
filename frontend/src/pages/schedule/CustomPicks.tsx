import { useState } from 'react'
import { Button, Card, Chip, SelectField } from '../../components/ui'
import { formatHour, timeOptions } from '../../lib/format'
import { DAY_LABELS, type Day } from '../../types'

export interface CustomPick {
  day: Day
  start: number
}

const dayOptions = [...DAY_LABELS]
const startOptions = timeOptions(6, 23.5).map(formatHour)

/** "10:30" → 10.5 */
function parseHour(text: string): number {
  const [h, m] = text.split(':').map(Number)
  return h + m / 60
}

interface CustomPicksProps {
  picks: CustomPick[]
  /** 추천 시간까지 포함해 이미 후보인지 */
  isTaken: (p: CustomPick) => boolean
  /** 후보를 더 넣을 수 있는지 */
  canAddMore: boolean
  /** 그 시작 시각에 가능한 인원 (계산 범위 밖이면 undefined) */
  availableAt: (p: CustomPick) => number | undefined
  total: number
  onAdd: (p: CustomPick) => void
  onRemove: (p: CustomPick) => void
  maxText: string
}

/** 추천 시간 외에 팀장·팀원이 원하는 시작 시간을 후보로 직접 넣는 영역 */
export function CustomPicks({ picks, isTaken, canAddMore, availableAt, total, onAdd, onRemove, maxText }: CustomPicksProps) {
  const [day, setDay] = useState<string>(DAY_LABELS[0])
  const [start, setStart] = useState('09:00')
  const [error, setError] = useState<string | null>(null)

  const current = (): CustomPick => ({ day: DAY_LABELS.indexOf(day as (typeof DAY_LABELS)[number]) as Day, start: parseHour(start) })

  const add = () => {
    const p = current()
    if (isTaken(p)) return setError('이미 후보에 있는 시간이에요.')
    if (!canAddMore) return setError(maxText)
    setError(null)
    onAdd(p)
  }

  return (
    <section aria-labelledby="custom-title" className="flex flex-col gap-2">
      <h2 id="custom-title" className="m-0 text-base font-bold">
        원하는 시간 추가
      </h2>
      {picks.map((p) => {
        const n = availableAt(p)
        return (
          <div key={`${p.day}-${p.start}`} className="flex min-h-14 items-center gap-3 rounded-control border border-line bg-surface px-4">
            <span className="text-base font-bold">
              {DAY_LABELS[p.day]} {formatHour(p.start)} 시작
            </span>
            {n !== undefined && (
              <span className="ml-auto">
                <Chip tone={n === total ? 'accent' : 'neutral'}>
                  {n === total ? '전원 가능' : `${n}/${total}명 가능`}
                </Chip>
              </span>
            )}
            <button
              type="button"
              onClick={() => onRemove(p)}
              aria-label={`${DAY_LABELS[p.day]} ${formatHour(p.start)} 후보 삭제`}
              className={`min-h-11 px-2 text-sm font-medium text-danger ${n === undefined ? 'ml-auto' : ''}`}
            >
              삭제
            </button>
          </div>
        )
      })}
      <Card tone="plain" className="flex flex-col gap-3">
        <div className="flex gap-3">
          <div className="min-w-0 flex-1">
            <SelectField label="요일" value={day} options={dayOptions} onChange={(e) => { setDay(e.target.value); setError(null) }} />
          </div>
          <div className="min-w-0 flex-1">
            <SelectField label="시작" value={start} options={startOptions} onChange={(e) => { setStart(e.target.value); setError(null) }} error={error ?? undefined} />
          </div>
        </div>
        <Button type="button" variant="secondary" onClick={add}>
          후보로 추가
        </Button>
      </Card>
    </section>
  )
}
