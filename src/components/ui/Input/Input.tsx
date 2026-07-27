import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'
import type { AccessibleLabel } from '../accessibility'
import './Input.css'

export type InputProps = AccessibleLabel & {
  helper?: string
  error?: string
  prefix?: string
  id?: string
  disabled?: boolean
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'disabled'>

export function Input({
  label,
  ariaLabel,
  helper,
  error,
  prefix,
  id,
  disabled,
  ...nativeProps
}: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className="input">
      {label ? <label htmlFor={inputId}>{label}</label> : null}
      <div className="input__field">
        {prefix ? <span className="input__prefix">{prefix}</span> : null}
        <input
          id={inputId}
          className="input__control"
          disabled={disabled}
          aria-label={ariaLabel}
          {...nativeProps}
        />
      </div>
      {helper ? <span className="input__helper">{helper}</span> : null}
      {error ? <span className="input__error">{error}</span> : null}
    </div>
  )
}
