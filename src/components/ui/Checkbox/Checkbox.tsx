import { useId } from 'react'
import type { AccessibleLabel } from '../accessibility'
import './Checkbox.css'

export type CheckboxProps = AccessibleLabel & {
  checked?: boolean
  onChange?: (checked: boolean) => void
  id?: string
  disabled?: boolean
}

export function Checkbox({
  label,
  ariaLabel,
  checked = false,
  onChange,
  id,
  disabled,
}: CheckboxProps) {
  const generatedId = useId()
  const checkboxId = id ?? generatedId

  const input = (
    <input
      type="checkbox"
      id={checkboxId}
      className="checkbox__input"
      checked={checked}
      disabled={disabled}
      aria-label={label ? undefined : ariaLabel}
      onChange={(event) => onChange?.(event.target.checked)}
    />
  )

  if (label) {
    return (
      <label htmlFor={checkboxId} className="checkbox">
        {input}
        <span className="checkbox__box" aria-hidden="true" />
        <span className="checkbox__label">{label}</span>
      </label>
    )
  }

  return (
    <span className="checkbox">
      {input}
      <span className="checkbox__box" aria-hidden="true" />
    </span>
  )
}
