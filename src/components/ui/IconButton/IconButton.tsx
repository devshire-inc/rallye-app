import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './IconButton.css'

export interface IconButtonProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    'className' | 'title' | 'aria-label' | 'onClick' | 'disabled' | 'type'
  > {
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
  ...nativeProps
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={`icon-button icon-button--${variant} icon-button--${size}`}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      {...nativeProps}
    >
      {children}
    </button>
  )
}
