import { useId } from 'react'
import type { AccessibleLabel } from '../accessibility'
import './Radio.css'

export type RadioProps = AccessibleLabel & {
  checked?: boolean
  onChange?: (checked: boolean) => void
  name?: string
  id?: string
  disabled?: boolean
}

export function Radio({
  label,
  ariaLabel,
  checked = false,
  onChange,
  name,
  id,
  disabled,
}: RadioProps) {
  const generatedId = useId()
  const radioId = id ?? generatedId

  const input = (
    <input
      type="radio"
      id={radioId}
      name={name}
      className="radio__input"
      checked={checked}
      disabled={disabled}
      aria-label={label ? undefined : ariaLabel}
      onChange={(event) => onChange?.(event.target.checked)}
    />
  )

  const dot = (
    <span className="radio__box" aria-hidden="true">
      {checked && <span className="radio__dot" />}
    </span>
  )

  const className = disabled ? 'radio radio--disabled' : 'radio'

  if (label) {
    return (
      <label htmlFor={radioId} className={className}>
        {input}
        {dot}
        <span className="radio__label">{label}</span>
      </label>
    )
  }

  return (
    <span className={className}>
      {input}
      {dot}
    </span>
  )
}
