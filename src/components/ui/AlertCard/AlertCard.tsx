import type { ReactNode } from 'react'
import { Icon, type IconName } from '../Icon/Icon'
import './AlertCard.css'

export type AlertCardTone = 'warning' | 'danger' | 'info' | 'success'

const TONE_ICON: Record<AlertCardTone, IconName> = {
  warning: 'alert-triangle',
  danger: 'x-circle',
  info: 'info',
  success: 'check-circle',
}

export interface AlertCardProps {
  tone?: AlertCardTone
  children?: ReactNode
  /** Ícone custom para o slot circular à esquerda do texto (Figma node 150:1311). Sobrepõe o ícone automático de `showIcon`. */
  icon?: ReactNode
  /** Exibe o ícone padrão do `tone` no slot à esquerda. `false` por padrão — não muda a aparência dos usos existentes. */
  showIcon?: boolean
}

/**
 * Variante tingida do Card (node Figma 102:6) para seções condicionais/aviso
 * — texto tonal (cor por `tone`) sobre fundo e borda tonais. Não é acionável.
 */
export function AlertCard({ tone = 'warning', children, icon, showIcon = false }: AlertCardProps) {
  const resolvedIcon = icon ?? (showIcon ? <Icon name={TONE_ICON[tone]} size={20} /> : null)

  return (
    <div className={`alert-card alert-card--${tone}`}>
      {resolvedIcon && <span className="alert-card__icon">{resolvedIcon}</span>}
      <div className="alert-card__text">{children}</div>
    </div>
  )
}
