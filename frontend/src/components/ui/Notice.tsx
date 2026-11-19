import type { ReactNode } from 'react'
import { cx } from './cx'

export function Notice({ tone = 'warn', children }: { tone?: 'warn' | 'neutral'; children: ReactNode }) {
  return (
    <div
      className={cx(
        'rounded-control px-3.5 py-3 text-sm leading-relaxed',
        tone === 'warn' ? 'bg-warn-soft text-warn-deep' : 'bg-soft text-ink-2',
      )}
    >
      {children}
    </div>
  )
}
