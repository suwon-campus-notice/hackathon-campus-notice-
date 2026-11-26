import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * 뒤로 가기 동작
 * - `{ to }`: 직전 화면으로 돌아간다. 주소를 바로 열어 돌아갈 기록이 없으면 `to` 로 간다.
 * - `{ to, always: true }`: 항상 `to` 로 간다(예: 팀 홈 → 내 팀 목록).
 * - `{ onClick }`: 화면 안의 단계를 되돌릴 때(예: 비밀번호 찾기 2단계 → 1단계).
 */
export type BackAction = { to: string; always?: boolean } | { onClick: () => void }

interface TopBarProps {
  title: string
  description?: ReactNode
  /** 왼쪽 위 뒤로 가기 버튼. 하단 탭이 있는 최상위 화면에는 두지 않는다. */
  back?: BackAction
  /** 제목 오른쪽에 붙는 표시(예: 팀장 표시) */
  badge?: ReactNode
}

function BackButton({ back }: { back: BackAction }) {
  const navigate = useNavigate()
  const { key } = useLocation()

  function go() {
    if ('onClick' in back) return back.onClick()
    // key 가 'default' 이면 이 앱에서 처음 연 화면이라 돌아갈 기록이 없다.
    if (back.always || key === 'default') navigate(back.to, { replace: true })
    else navigate(-1)
  }

  return (
    <button
      type="button"
      onClick={go}
      aria-label="뒤로 가기"
      className="-ml-2.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-transparent text-ink"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  )
}

export function TopBar({ title, description, back, badge }: TopBarProps) {
  return (
    <header className={`flex flex-col gap-1 px-4 pb-2 ${back ? 'pt-2' : 'pt-5'}`}>
      <div className="flex items-center gap-1">
        {back && <BackButton back={back} />}
        <h1 className="m-0 flex-1 text-[22px] font-bold">{title}</h1>
        {badge}
      </div>
      {description && <p className="m-0 text-sm text-muted">{description}</p>}
    </header>
  )
}
