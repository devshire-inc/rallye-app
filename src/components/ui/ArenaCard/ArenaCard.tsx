import type { CSSProperties } from 'react'
import { sportCssVar } from '../../../lib/sports'
import { Badge, type BadgeProps } from '../Badge/Badge'
import { ListRow } from '../ListRow/ListRow'
import './ArenaCard.css'

export interface ArenaCardProps {
  name: string
  /** Endereço ou nº de membros, ex.: "Rua das Palmeiras, 120" ou "8 membros". */
  subtitle?: string
  avatarSrc?: string
  /** Papéis do usuário na arena, ex.: `['Dono', 'Admin']` — vira "DONO · ADMIN" no selo. */
  roles?: string[]
  /** Tom do selo de papel (Figma: Dono/Admin = success, Professor = info). Default `success`, igual ao comportamento anterior. */
  roleTone?: BadgeProps['tone']
  /** Slugs de esporte (ver `SPORTS` em `lib/sports.ts`) — um dot colorido por esporte oferecido. */
  sports?: string[]
  onClick?: () => void
  /** Estado visualmente desabilitado (opacidade reduzida, sem hover, sem clique) — ex.: os demais cards enquanto um deles está entrando. */
  disabled?: boolean
  /** Vira `data-arena` no elemento raiz, pra hooks de teste localizarem o card sem depender do texto. */
  testId?: string
}

export function ArenaCard({
  name,
  subtitle,
  avatarSrc,
  roles = [],
  roleTone = 'success',
  sports = [],
  onClick,
  disabled = false,
  testId,
}: ArenaCardProps) {
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
              <Badge tone={roleTone}>{roles.join(' · ').toUpperCase()}</Badge>
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

  const className = disabled ? 'arena-card arena-card--disabled' : 'arena-card'

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        data-arena={testId}
      >
        {content}
      </button>
    )
  }

  return (
    <div className={className} data-arena={testId}>
      {content}
    </div>
  )
}
