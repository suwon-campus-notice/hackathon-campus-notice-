import type { ReactNode } from 'react'
import { cx } from './cx'

export type ChipTone = 'neutral' | 'accent' | 'warn' | 'solid'

const tones: Record<ChipTone, string> = {
  neutral: 'bg-soft text-ink-2',
  accent: 'bg-accent-soft text-accent-ink',
  warn: 'bg-warn-soft text-warn-ink',
  solid: 'bg-accent text-white',
}

export function Chip({ tone = 'neutral', children }: { tone?: ChipTone; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', tones[tone])}>
      {children}
    </span>
  )
}
