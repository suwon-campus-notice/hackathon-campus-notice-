import { useId } from 'react'
import { Card, cx } from '../../components/ui'

interface VoteOptionCardProps {
  label: string
  count: number
  teamSize: number
  need: number
  /** 이 후보를 고른 사람 이름 */
  voters: string[]
  emptyText: string
  /** 있으면 체크 상자를 보여주는 선택 모드 */
  check?: { checked: boolean; onChange: (checked: boolean) => void }
  /** 투표 후 내가 고른 후보 (파랗게 표시) */
  mine?: boolean
}

/** 투표 후보 한 장: 이름, 득표 수, 막대(과반 위치 표시), 투표한 사람 */
export function VoteOptionCard({ label, count, teamSize, need, voters, emptyText, check, mine }: VoteOptionCardProps) {
  const id = useId()
  const title = (
    <span className={cx('flex-1 text-[17px] font-bold', mine ? 'text-accent-ink' : 'text-ink')}>{label}</span>
  )
  const body = (
    <>
      {mine && <span className="text-xs font-medium text-accent-ink">내 선택</span>}
      <span className="text-sm font-medium text-ink-2">{count}명</span>
    </>
  )
  return (
    <Card tone={mine ? 'selected' : 'plain'} className="flex flex-col gap-3">
      {check ? (
        <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3">
          <input
            id={id}
            type="checkbox"
            checked={check.checked}
            onChange={(e) => check.onChange(e.target.checked)}
            className="size-6 shrink-0 accent-accent"
          />
          {title}
          {body}
        </label>
      ) : (
        <div className="flex min-h-8 items-center gap-3">
          {title}
          {body}
        </div>
      )}
      <div aria-hidden="true" className="relative h-2 rounded-full bg-soft">
        <div
          className={cx('h-2 rounded-full', mine ? 'bg-accent' : 'bg-accent-light')}
          style={{ width: `${Math.min(100, (count / teamSize) * 100)}%` }}
        />
        <div className="absolute -top-1 h-4 w-0.5 rounded-[1px] bg-ink" style={{ left: `${(need / teamSize) * 100}%` }} />
      </div>
      <div className="flex justify-between gap-3 text-xs text-muted">
        <span>{voters.length ? voters.join(' · ') : emptyText}</span>
        <span>과반 {need}명</span>
      </div>
    </Card>
  )
}
