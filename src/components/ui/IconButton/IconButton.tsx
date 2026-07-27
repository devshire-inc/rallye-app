import type { ReactNode } from 'react'
import './IconButton.css'

export interface IconButtonProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'secondary' | 'ghost'
  label: string
  children?: ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
}

export function IconButton({
  size = 'md',
  variant = 'primary',
  label,
  children,
  onClick,
  disabled = false,
  type = 'button',
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={`icon-button icon-button--${variant} icon-button--${size}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
