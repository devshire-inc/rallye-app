import type { ReactNode } from 'react'
import './Button.css'

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  disabled?: boolean
  /** Mostra um spinner no lugar do `icon` e reduz a opacidade do rótulo. O
   * botão fica nativamente desabilitado (não dispara `onClick`) enquanto
   * `loading` for `true`, mas mantém a cor de fundo cheia — ver node Figma
   * 19:54 "State=Loading". */
  loading?: boolean
  icon?: ReactNode
  children?: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  icon,
  children,
  onClick,
  type = 'button',
}: ButtonProps) {
  const className = [
    'button',
    `button--${variant}`,
    `button--${size}`,
    fullWidth ? 'button--full-width' : '',
    loading ? 'button--loading' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type={type}
      className={className}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={onClick}
    >
      {loading ? <span className="button__spinner" aria-hidden="true" /> : icon}
      <span className="button__label">{children}</span>
    </button>
  )
}
