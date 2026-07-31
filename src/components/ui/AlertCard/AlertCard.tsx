import type { ReactNode } from 'react'
import './AlertCard.css'

export type AlertCardTone = 'warning' | 'danger' | 'info' | 'success'

export interface AlertCardProps {
  tone?: AlertCardTone
  children?: ReactNode
}

/**
 * Variante tingida do Card (node Figma 102:6) para seções condicionais/aviso
 * — texto normal (text/heading) sobre fundo e borda tonais. Não é acionável.
 */
export function AlertCard({ tone = 'warning', children }: AlertCardProps) {
  return <div className={`alert-card alert-card--${tone}`}>{children}</div>
}
