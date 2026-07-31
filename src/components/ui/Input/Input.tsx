import { useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import type { AccessibleLabel } from '../accessibility'
import './Input.css'

export type InputProps = AccessibleLabel & {
  helper?: string
  error?: string
  prefix?: string
  /** Trailing slot inside the field, e.g. PasswordInput's show/hide toggle. */
  suffix?: ReactNode
  /** Extra class(es) on the outer wrapper div — for composing components
   * (e.g. PasswordInput) that need to scope a CSS override, without
   * clobbering `input__control` the way a plain `className` would (that one
   * lands on the native `<input>` via the native-attrs spread). */
  wrapperClassName?: string
  id?: string
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'disabled' | 'size'>

export function Input({
  label,
  ariaLabel,
  helper,
  error,
  prefix,
  suffix,
  wrapperClassName,
  id,
  disabled,
  size = 'md',
  ...nativeProps
}: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  const fieldClassName = ['input__field', `input__field--${size}`, error ? 'input__field--error' : '']
    .filter(Boolean)
    .join(' ')

  const wrapperClasses = ['input', disabled ? 'input--disabled' : '', wrapperClassName ?? '']
    .filter(Boolean)
    .join(' ')

  return (
    <div className={wrapperClasses}>
      {label ? <label htmlFor={inputId}>{label}</label> : null}
      <div className={fieldClassName}>
        {prefix ? <span className="input__prefix">{prefix}</span> : null}
        <input
          id={inputId}
          className="input__control"
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
          {...nativeProps}
        />
        {suffix}
      </div>
      {helper ? <span className="input__helper">{helper}</span> : null}
      {error ? <span className="input__error">{error}</span> : null}
    </div>
  )
}
