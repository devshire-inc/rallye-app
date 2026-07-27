import type { CSSProperties } from 'react'
import { sportCssVar } from '../../../lib/sports'
import { Avatar } from '../Avatar/Avatar'
import { Badge } from '../Badge/Badge'
import './ClassCard.css'

export interface ClassCardProps {
  title?: string
  sport: string
  time?: string
  court?: string
  coach?: string
  status?: 'confirmada' | 'pendente' | 'cancelada'
  onClick?: () => void
}

const STATUS_TONE = {
  confirmada: 'success',
  pendente: 'warning',
  cancelada: 'danger',
} as const

const STATUS_LABEL = {
  confirmada: 'Confirmada',
  pendente: 'Pendente',
  cancelada: 'Cancelada',
} as const

export function ClassCard({ title, sport, time, court, coach, status, onClick }: ClassCardProps) {
  const style = { '--class-card-accent': `var(${sportCssVar(sport)})` } as CSSProperties

  const content = (
    <>
      <span className="class-card__accent" aria-hidden="true" />
      <div className="class-card__body">
        <div className="class-card__header">
          {title ? <span className="class-card__title">{title}</span> : null}
          {status ? <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge> : null}
        </div>
        <div className="class-card__meta">
          {time ? <span>{time}</span> : null}
          {court ? <span>{court}</span> : null}
        </div>
        {coach ? (
          <div className="class-card__coach">
            <Avatar name={coach} size={28} />
            <span>{coach}</span>
          </div>
        ) : null}
      </div>
    </>
  )

  if (onClick) {
    return (
      <button type="button" className="class-card" style={style} onClick={onClick}>
        {content}
      </button>
    )
  }

  return (
    <div className="class-card" style={style}>
      {content}
    </div>
  )
}
