import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { useId } from 'react'
import { cx } from './cx'

interface FieldShellProps {
  label: string
  error?: string
  hint?: string
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
}

function FieldShell({ label, error, hint, children }: FieldShellProps) {
  const id = useId()
  const msgId = `${id}-msg`
  const describedBy = error || hint ? msgId : undefined
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink-2">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <span id={msgId} role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </span>
      ) : hint ? (
        <span id={msgId} className="text-xs text-muted">
          {hint}
        </span>
      ) : null}
    </div>
  )
}

const controlClass = (invalid: boolean) =>
  cx(
    'min-h-12 w-full min-w-0 rounded-control bg-surface px-3.5 text-base text-ink',
    invalid ? 'border-2 border-danger' : 'border border-line-strong',
  )

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string
  error?: string
  hint?: string
}

export function TextField({ label, error, hint, className, ...rest }: TextFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cx(controlClass(invalid), className)}
          {...rest}
        />
      )}
    </FieldShell>
  )
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string
  error?: string
  hint?: string
  options: string[]
}

export function SelectField({ label, error, hint, options, className, ...rest }: SelectFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cx(controlClass(invalid), 'px-2.5', className)}
          {...rest}
        >
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      )}
    </FieldShell>
  )
}
