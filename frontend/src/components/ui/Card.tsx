import type { ReactNode } from 'react'
import { cx } from './cx'

export function Card({
  children,
  className,
  tone = 'plain',
}: {
  children: ReactNode
  className?: string
  tone?: 'plain' | 'selected' | 'solid'
}) {
  return (
    <div
      className={cx(
        'rounded-card p-4',
        tone === 'plain' && 'border border-line bg-surface',
        tone === 'selected' && 'border-2 border-accent bg-accent-soft',
        tone === 'solid' && 'bg-accent text-white',
        className,
      )}
    >
      {children}
    </div>
  )
}
