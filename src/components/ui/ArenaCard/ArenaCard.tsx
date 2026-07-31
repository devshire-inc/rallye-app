import type { CSSProperties } from 'react'
import { sportCssVar } from '../../../lib/sports'
import { Badge } from '../Badge/Badge'
import { ListRow } from '../ListRow/ListRow'
import './ArenaCard.css'

export interface ArenaCardProps {
  name: string
  /** Endereço ou nº de membros, ex.: "Rua das Palmeiras, 120" ou "8 membros". */
  subtitle?: string
  avatarSrc?: string
  /** Papéis do usuário na arena, ex.: `['Dono', 'Admin']` — vira "DONO · ADMIN" no selo. */
  roles?: string[]
  /** Slugs de esporte (ver `SPORTS` em `lib/sports.ts`) — um dot colorido por esporte oferecido. */
  sports?: string[]
  onClick?: () => void
}

export function ArenaCard({ name, subtitle, avatarSrc, roles = [], sports = [], onClick }: ArenaCardProps) {
  const content = (
    <>
      {/* ListRow traz seu próprio card (bg/padding/radius) para uso solto em
       * listas — aqui ele já vive dentro do card do ArenaCard, então essa
       * casca é removida via override (.arena-card__row .list-row), ficando
       * só o layout avatar + título + chevron do Figma node 126:294. */}
      <div className="arena-card__row">
        <ListRow leading={{ type: 'avatar', name, src: avatarSrc }} title={name} meta={subtitle} trailing={{ type: 'chevron' }} />
      </div>
      {roles.length > 0 || sports.length > 0 ? (
        <div className="arena-card__meta-row">
          {roles.length > 0 ? (
            <span className="arena-card__role-badge">
              <Badge tone="success">{roles.join(' · ').toUpperCase()}</Badge>
            </span>
          ) : null}
          {sports.length > 0 ? (
            <span className="arena-card__dots" aria-hidden="true">
              {sports.map((sport, index) => (
                <span
                  key={`${sport}-${index}`}
                  className="arena-card__dot"
                  style={{ '--dot-color': `var(${sportCssVar(sport)})` } as CSSProperties}
                />
              ))}
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  )

  if (onClick) {
    return (
      <button type="button" className="arena-card" onClick={onClick}>
        {content}
      </button>
    )
  }

  return <div className="arena-card">{content}</div>
}
