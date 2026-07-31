import { SportTag } from '../SportTag/SportTag'
import {
  EVENT_STATUS_ACCESSIBLE_LABEL,
  EventStatusBadge,
  type EventStatus,
} from '../EventStatusBadge/EventStatusBadge'
import './EventCard.css'

export type EventType = 'torneio' | 'experimental' | 'social' | 'bloqueio'

export interface EventCardProps {
  type: EventType
  title: string
  date: string
  location?: string
  /** Slug de `lib/sports` — Bloqueio não tem esporte, ver `type`. */
  sport?: string
  /** Situação de inscrição do usuário — Bloqueio não tem, ver `type`. */
  status?: EventStatus
  /** Ignorado quando `type === 'bloqueio'`: o card de manutenção nunca é
   * interativo para o aluno (ver doc do Figma, seção Acessibilidade). */
  onClick?: () => void
}

const TYPE_EYEBROW: Record<EventType, string> = {
  torneio: 'TORNEIO',
  experimental: 'AULA EXPERIMENTAL',
  social: 'EVENTO SOCIAL',
  bloqueio: 'MANUTENÇÃO',
}

function buildAccessibleLabel({ title, date, location, status }: EventCardProps): string {
  return [title, date, location, status ? EVENT_STATUS_ACCESSIBLE_LABEL[status] : null]
    .filter(Boolean)
    .join(', ')
}

/**
 * Card de evento da arena (Figma node 129:2, variants node 263:1156):
 * Type=Torneio|Experimental|Social|Bloqueio. A situação de inscrição vem
 * do EventStatusBadge aninhado e o esporte, do SportTag aninhado — nenhum
 * dos dois é reimplementado aqui. Bloqueio não tem esporte nem status e
 * renderiza como `<article>` não interativo, fora da ordem de foco (não
 * é um card clicável para o aluno).
 */
export function EventCard({ type, title, date, location, sport, status, onClick }: EventCardProps) {
  const isBloqueio = type === 'bloqueio'
  const isTorneio = type === 'torneio'
  const showSport = !isBloqueio && sport
  const showStatus = !isBloqueio && status

  const content = (
    <>
      {isTorneio ? <span className="event-card__decoration" aria-hidden="true" /> : null}
      <div className="event-card__header">
        <span className="event-card__eyebrow">{TYPE_EYEBROW[type]}</span>
        {showStatus ? <EventStatusBadge status={status} /> : null}
      </div>
      <span className="event-card__title">{title}</span>
      <div className="event-card__meta">
        <span>{date}</span>
        {location ? <span>{location}</span> : null}
      </div>
      {showSport ? <SportTag sport={sport} /> : null}
    </>
  )

  if (isBloqueio) {
    return <article className="event-card event-card--bloqueio">{content}</article>
  }

  if (onClick) {
    return (
      <button
        type="button"
        className={`event-card event-card--${type}`}
        onClick={onClick}
        aria-label={buildAccessibleLabel({ type, title, date, location, status })}
      >
        {content}
      </button>
    )
  }

  return <div className={`event-card event-card--${type}`}>{content}</div>
}
