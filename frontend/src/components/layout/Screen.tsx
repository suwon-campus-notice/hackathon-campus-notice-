import type { ReactNode } from 'react'

/** 모바일 폭(최대 430px) 한 화면의 바깥 틀. nav 는 맨 아래 탭 바. */
export function Screen({ children, nav }: { children: ReactNode; nav?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-ground">
      <main className="flex flex-1 flex-col">{children}</main>
      {nav}
    </div>
  )
}

/** 화면 맨 아래에 붙는 버튼 영역 */
export function BottomActions({ children }: { children: ReactNode }) {
  return <div className="sticky bottom-0 mt-auto flex flex-col gap-2 bg-ground px-4 pb-5 pt-3">{children}</div>
}

/** 화면 본문 영역(좌우 여백 포함) */
export function Body({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-5 px-4 pt-3 ${className}`}>{children}</div>
}
