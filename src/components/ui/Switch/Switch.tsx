import { useId } from 'react'
import type { AccessibleLabel } from '../accessibility'
import './Switch.css'

export type SwitchProps = AccessibleLabel & {
  checked?: boolean
  onChange?: (checked: boolean) => void
  id?: string
  disabled?: boolean
}

export function Switch({ label, ariaLabel, checked = false, onChange, id, disabled }: SwitchProps) {
  const generatedId = useId()
  const switchId = id ?? generatedId

  const button = (
    <button
      type="button"
      id={switchId}
      role="switch"
      aria-checked={checked}
      className="switch"
      disabled={disabled}
      aria-label={label ? undefined : ariaLabel}
      onClick={() => onChange?.(!checked)}
    >
      <span className="switch-track">
        <span className="switch-thumb" />
      </span>
    </button>
  )

  if (label) {
    return (
      <label htmlFor={switchId} className="switch-field">
        <span className="switch-field__label">{label}</span>
        {button}
      </label>
    )
  }

  return button
}
