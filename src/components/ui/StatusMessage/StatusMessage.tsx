import type { ReactNode } from 'react'
import { Button } from '../Button/Button'
import './StatusMessage.css'

export type StatusMessageStyle = 'banner' | 'fullscreen'
export type StatusMessageTone = 'success' | 'warning' | 'danger' | 'info'

export interface StatusMessageAction {
  label: string
  onClick?: () => void
  variant?: 'primary' | 'secondary'
}

export interface StatusMessageProps {
  style?: StatusMessageStyle
  tone?: StatusMessageTone
  title: string
  description?: string
  showDescription?: boolean
  /** Só usado no style="fullscreen" — até 2 ações (Buttons expostos no Figma). */
  actions?: StatusMessageAction[]
}

/**
 * Ícones inline temporários (glifos Feather: check, alert-triangle, x-circle,
 * info) até o componente Icon compartilhado (src/components/ui/Icon) expor
 * este mesmo conjunto — trocar por ele quando disponível (nós Figma 115:38,
 * 210:24, 210:19 e equivalente de danger).
 */
const TONE_ICON: Record<StatusMessageTone, (size: number) => ReactNode> = {
  success: (size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  warning: (size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  danger: (size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  info: (size) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
}

const TONE_LABEL: Record<StatusMessageTone, string> = {
  success: 'Sucesso',
  warning: 'Aviso',
  danger: 'Erro',
  info: 'Informação',
}

/**
 * Mensagem de status semântica (Figma node 100:2). Dois eixos: `style`
 * (banner = faixa inline sob campos/formulários; fullscreen = medalhão +
 * título + resumo + até 2 ações) e `tone` (success/warning/danger/info).
 * Nunca sobrescreva cor/ícone manualmente — troque o `tone`.
 */
export function StatusMessage({
  style = 'banner',
  tone = 'success',
  title,
  description,
  showDescription = true,
  actions = [],
}: StatusMessageProps) {
  const className = `status-message status-message--${style} status-message--${tone}`

  if (style === 'fullscreen') {
    return (
      <div className={className} role="status">
        <div className="status-message__medallion" aria-hidden="true">
          <div className="status-message__medallion-inner">{TONE_ICON[tone](24)}</div>
        </div>
        <p className="status-message__title">{title}</p>
        {showDescription && description && <p className="status-message__description">{description}</p>}
        {actions.length > 0 && (
          <div className="status-message__actions">
            {actions.slice(0, 2).map((action, index) => (
              <Button
                key={action.label}
                variant={action.variant ?? (index === 0 ? 'primary' : 'secondary')}
                fullWidth
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={className} role="status">
      <span className="status-message__icon" aria-label={TONE_LABEL[tone]}>
        {TONE_ICON[tone](20)}
      </span>
      <div className="status-message__body">
        <p className="status-message__title">{title}</p>
        {showDescription && description && <p className="status-message__description">{description}</p>}
      </div>
    </div>
  )
}
