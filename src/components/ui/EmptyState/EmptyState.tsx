import type { ReactNode } from 'react'
import { Button } from '../Button/Button'
import './EmptyState.css'

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

/**
 * Estado vazio de listas/agendas/buscas (Figma node 194:5). O título carrega a
 * informação — a ilustração é sempre decorativa (aria-hidden). O CTA só
 * aparece quando `actionLabel` e `onAction` são passados juntos.
 */
export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  const showAction = Boolean(actionLabel && onAction)

  return (
    <div className="empty-state">
      <div className="empty-state__illustration" aria-hidden="true">
        {icon}
      </div>
      <p className="empty-state__title">{title}</p>
      {description && <p className="empty-state__description">{description}</p>}
      {showAction && (
        <Button variant="primary" size="md" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
