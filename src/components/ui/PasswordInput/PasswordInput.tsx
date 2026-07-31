import { useId, useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { Input } from '../Input/Input'
import { IconButton } from '../IconButton/IconButton'
import { Icon } from '../Icon/Icon'
import type { AccessibleLabel } from '../accessibility'
import './PasswordInput.css'

export type PasswordInputProps = AccessibleLabel & {
  helper?: string
  error?: string
  id?: string
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'disabled' | 'size' | 'type'>

/**
 * Password field with a show/hide toggle (Figma node 276:1437). Composes
 * `Input` for the label/field/helper/error anatomy and adds the toggle on
 * top — never reimplements the border/label/error rendering.
 */
export function PasswordInput({
  label,
  ariaLabel,
  helper,
  error,
  id,
  disabled,
  size = 'md',
  ...nativeProps
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  const generatedId = useId()
  const inputId = id ?? generatedId
  const accessibleLabel = (label ? { label } : { ariaLabel }) as AccessibleLabel

  function toggleVisibility() {
    setVisible((v) => !v)
    // Focus stays on the field itself when the mask toggles (Figma
    // doc/ACESSIBILIDADE), not on the button that was just clicked.
    document.getElementById(inputId)?.focus()
  }

  return (
    <Input
      {...accessibleLabel}
      id={inputId}
      helper={helper}
      error={error}
      disabled={disabled}
      size={size}
      wrapperClassName="password-input"
      type={visible ? 'text' : 'password'}
      suffix={
        <IconButton
          variant="ghost"
          size="sm"
          label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          onClick={toggleVisibility}
          disabled={disabled}
          aria-pressed={visible}
        >
          <Icon name={visible ? 'eye-off' : 'eye'} ariaHidden />
        </IconButton>
      }
      {...nativeProps}
    />
  )
}
