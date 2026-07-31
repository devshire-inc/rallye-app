import type { ReactNode } from 'react'
import { IconButton } from './ui/IconButton/IconButton'
import './Toast.css'

export type ToastTone = 'success' | 'warning' | 'danger' | 'info'
export type ToastLayout = 'mobile' | 'desktop'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastProps {
  message: string | null
  onDismiss: () => void
  /** BEAC-1907 (T3 — toast "Presença registrada!" de sucesso): default
   * 'error' preserva o visual/comportamento anterior para todo chamador que
   * não passa esta prop (LoginPage/SignupPage/ResetPassword). Mantida por
   * compat — novos chamadores devem preferir `tone`, que tem precedência
   * quando as duas são passadas. Sem nenhuma das duas, o resultado é o mesmo
   * de antes: danger (era 'error'). */
  variant?: 'error' | 'success'
  /** Figma node 194:3 — substitui `variant` para os 4 tons reais do design
   * (success/warning/danger/info). Se omitido, é derivado de `variant`. */
  tone?: ToastTone
  /** Mobile ancora embaixo (358px); Desktop, no canto superior direito
   * (420px) — nota de uso do doc Figma (node 239:546). Se omitido, a
   * posição segue o mesmo breakpoint de shell usado por AppShell
   * (`BREAKPOINT_SHELL_DESKTOP_MIN`, ver src/lib/breakpoints.ts) via
   * `@media` — sem JS. Passe explicitamente só quando precisar forçar um
   * layout independente do viewport (ex.: Storybook, testes). */
  layout?: ToastLayout
  /** HasAction=true no Figma — link de ação curto e reversível (ex.:
   * "Desfazer"), renderizado em `state/{tone}`. */
  action?: ToastAction
}

/** Mesmos glifos Feather inline usados por StatusMessage (nós Figma 115:38,
 * 210:24, 210:19 e equivalente de danger) — trocar por Icon compartilhado
 * quando disponível, junto com o mesmo TODO já registrado lá. */
const TONE_ICON: Record<ToastTone, ReactNode> = {
  success: (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  warning: (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  danger: (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  info: (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
}

/** O doc do Figma (node 239:546) só nomeia "Danger" como assertive; Warning
 * fica de fora do texto. Tratamos os dois tons de alerta (warning e danger)
 * como assertive pela mesma lógica de urgência — só success/info, que nunca
 * exigem ação do usuário, ficam polite. */
const TONE_ARIA_LIVE: Record<ToastTone, 'polite' | 'assertive'> = {
  success: 'polite',
  info: 'polite',
  warning: 'assertive',
  danger: 'assertive',
}

/**
 * Toast (Figma node 194:3). 16 variantes: Tone(Success|Warning|Danger|Info) ×
 * Layout(Mobile 358px|Desktop 420px) × HasAction. Fundo surface/inverse com
 * shadow, barra de acento de 4px em state/{tone}, ícone recolorido no mesmo
 * tom, mensagem em text/inverse, ação opcional em state/{tone} e botão
 * fechar. Nunca recebe foco (role="status") — por isso ação e fechar
 * continuam alcançáveis por teclado enquanto o toast está visível. Duração
 * mínima de 5s é responsabilidade de quem dispara o toast (ex.: useToast) —
 * este componente não tem timer próprio, só renderiza.
 */
export function Toast({ message, onDismiss, variant = 'error', tone, layout, action }: ToastProps) {
  if (!message) return null

  const resolvedTone: ToastTone = tone ?? (variant === 'success' ? 'success' : 'danger')
  const layoutClass = layout ? `toast--pos-${layout}` : 'toast--pos-auto'

  return (
    <div
      role="status"
      aria-live={TONE_ARIA_LIVE[resolvedTone]}
      className={`toast toast--${resolvedTone} ${layoutClass}`}
    >
      <span className="toast__accent" aria-hidden="true" />
      <span className="toast__icon" aria-hidden="true">
        {TONE_ICON[resolvedTone]}
      </span>
      <p className="toast__message">{message}</p>
      {action && (
        <button type="button" className="toast__action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
      <span className="toast__close">
        <IconButton variant="ghost" size="sm" label="Fechar" onClick={onDismiss}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </IconButton>
      </span>
    </div>
  )
}
