import { NavLink } from 'react-router-dom'
import { cx } from '../ui'

interface Item {
  to: string
  label: string
  /** 정확히 이 주소일 때만 선택 표시 */
  end?: boolean
}

function TabBar({ items, label }: { items: Item[]; label: string }) {
  return (
    <nav aria-label={label} className="sticky bottom-0 flex border-t border-line bg-surface">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) =>
            cx(
              'flex min-h-14 flex-1 items-center justify-center text-sm no-underline',
              isActive ? 'font-bold text-accent shadow-[inset_0_3px_0_var(--color-accent)]' : 'font-medium text-muted',
            )
          }
        >
          {it.label}
        </NavLink>
      ))}
    </nav>
  )
}

/** 팀 밖 메인 메뉴: 팀 / 시간표 / 내 정보 */
export function MainTabBar() {
  return (
    <TabBar
      label="메인 메뉴"
      items={[
        { to: '/teams', label: '팀', end: true },
        { to: '/timetable', label: '시간표' },
        { to: '/me', label: '내 정보' },
      ]}
    />
  )
}

/** 팀 안 메뉴: 홈 / 일정 / 할 일 / 멤버 */
export function TeamTabBar({ teamId }: { teamId: string }) {
  const base = `/teams/${teamId}`
  return (
    <TabBar
      label="팀 메뉴"
      items={[
        { to: base, label: '홈', end: true },
        { to: `${base}/schedule`, label: '일정' },
        { to: `${base}/todos`, label: '할 일' },
        { to: `${base}/members`, label: '멤버' },
      ]}
    />
  )
}
