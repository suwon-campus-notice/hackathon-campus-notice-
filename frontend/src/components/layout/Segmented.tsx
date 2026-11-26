import { NavLink } from 'react-router-dom'
import { cx } from '../ui'

/** 같은 화면의 두 가지 보기를 오가는 전환(예: 표에서 선택 / 직접 입력) */
export function Segmented({ items }: { items: Array<{ to: string; label: string; end?: boolean }> }) {
  return (
    <div className="flex gap-1 rounded-control bg-soft p-1">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) =>
            cx(
              'flex min-h-11 flex-1 items-center justify-center rounded-[9px] text-sm no-underline',
              isActive ? 'bg-surface font-bold text-ink shadow-sm' : 'font-medium text-muted',
            )
          }
        >
          {it.label}
        </NavLink>
      ))}
    </div>
  )
}
