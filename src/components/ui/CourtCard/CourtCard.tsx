import type { CSSProperties } from 'react'
import { sportCssVar } from '../../../lib/sports'
import { SportTag } from '../SportTag/SportTag'
import './CourtCard.css'

export interface CourtCardProps {
  name?: string
  sport: string
  status?: string
  price?: string
  onClick?: () => void
}

export function CourtCard({ name, sport, status, price, onClick }: CourtCardProps) {
  const style = { '--court-card-accent': `var(${sportCssVar(sport)})` } as CSSProperties

  const content = (
    <>
      <div className="court-card__top" aria-hidden="true" />
      <div className="court-card__body">
        {name ? <span className="court-card__name">{name}</span> : null}
        <SportTag sport={sport} />
        {status ? <span className="court-card__status">{status}</span> : null}
        {price ? <span className="court-card__price">{price}</span> : null}
      </div>
    </>
  )

  if (onClick) {
    return (
      <button type="button" className="court-card" style={style} onClick={onClick}>
        {content}
      </button>
    )
  }

  return (
    <div className="court-card" style={style}>
      {content}
    </div>
  )
}
