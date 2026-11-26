import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cx } from './cx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerSolid'

const base =
  'inline-flex min-h-12 items-center justify-center rounded-control px-4 text-base font-medium no-underline transition-colors disabled:cursor-not-allowed'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white disabled:bg-line disabled:text-muted',
  secondary: 'border border-line-strong bg-surface text-ink',
  ghost: 'bg-transparent text-ink-2',
  danger: 'bg-transparent text-danger',
  dangerSolid: 'bg-danger text-white',
}

interface CommonProps {
  variant?: Variant
  /** 너비를 내용에 맞춘다(기본은 가로 가득) */
  inline?: boolean
  className?: string
  children: ReactNode
}

type ButtonProps = CommonProps & { to?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>
type LinkProps = CommonProps & { to: string }

/** `to` 가 있으면 링크, 없으면 버튼으로 그린다. */
export function Button(props: ButtonProps | LinkProps) {
  const { variant = 'primary', inline, className, children } = props
  const cls = cx(base, variants[variant], !inline && 'w-full', className)
  if (props.to !== undefined) {
    return (
      <Link to={props.to} className={cls}>
        {children}
      </Link>
    )
  }
  const { variant: _v, inline: _i, className: _c, children: _ch, to: _t, ...rest } = props
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  )
}
