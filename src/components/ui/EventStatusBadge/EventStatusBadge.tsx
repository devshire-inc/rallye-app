import { Badge, type BadgeProps } from '../Badge/Badge'
import './EventStatusBadge.css'

export type EventStatus = 'convite' | 'inscrito' | 'abertas' | 'lotado' | 'encerrado'

export interface EventStatusBadgeProps {
  status: EventStatus
}

const STATUS_TONE: Record<EventStatus, NonNullable<BadgeProps['tone']>> = {
  convite: 'info',
  inscrito: 'success',
  abertas: 'brand',
  lotado: 'warning',
  encerrado: 'neutral',
}

/** Rótulo visível (Figma: Overline, tudo em caixa alta). */
export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  convite: 'VOCÊ FOI CONVIDADO',
  inscrito: 'INSCRITO',
  abertas: 'INSCRIÇÕES ABERTAS',
  lotado: 'LOTADO',
  encerrado: 'ENCERRADO',
}

/** Fragmento em caixa baixa para compor o aria-label do EventCard (ver
 * doc do Figma: "inscrições abertas" e "lotado" mudam a ação esperada). */
export const EVENT_STATUS_ACCESSIBLE_LABEL: Record<EventStatus, string> = {
  convite: 'você foi convidado',
  inscrito: 'inscrito',
  abertas: 'inscrições abertas',
  lotado: 'lotado',
  encerrado: 'encerrado',
}

/**
 * Situação do usuário/evento (Figma node 263:876): convite, inscrito,
 * inscrições abertas, lotado ou encerrado. Reaproveita o Badge (mesmo
 * mapeamento tom -> cor) e só troca a tipografia para Overline + remove a
 * borda via CSS escopado — mesmo precedente do `.product-card__tag .badge`
 * em ProductCard, que já restiliza Badge por escopo em vez de duplicar o
 * mapeamento tom->cor.
 */
export function EventStatusBadge({ status }: EventStatusBadgeProps) {
  return (
    <span className="event-status-badge">
      <Badge tone={STATUS_TONE[status]}>{EVENT_STATUS_LABEL[status]}</Badge>
    </span>
  )
}
