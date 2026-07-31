import './AvatarIndicator.css'

export type AvatarIndicatorStatus = 'online' | 'offline' | 'confirmed' | 'pending'

export interface AvatarIndicatorProps {
  status?: AvatarIndicatorStatus
}

/**
 * Selo de presença/status (Figma node 258:557). Aninhado dentro de
 * `<Avatar indicator={...} />` (canto inferior direito) ou solto em listas
 * de chamada.
 *
 * Sempre `aria-hidden` — o dot nunca é o único sinal de presença: o texto
 * do estado ("Confirmado", "Pendente"...) precisa aparecer ao lado, na
 * própria linha/lista onde este componente é usado (ver Figma node 24:3,
 * "ACESSIBILIDADE").
 */
export function AvatarIndicator({ status = 'online' }: AvatarIndicatorProps) {
  return (
    <span className={`avatar-indicator avatar-indicator--${status}`} aria-hidden="true">
      {status === 'confirmed' ? <span className="avatar-indicator__check">✓</span> : null}
    </span>
  )
}
