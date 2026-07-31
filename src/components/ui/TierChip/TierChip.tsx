import type { CSSProperties } from 'react'
import './TierChip.css'

export type TierChipTier = 'pe-na-areia' | 'D' | 'C' | 'B' | 'A' | 'pro-open'

export interface TierChipProps {
  tier: TierChipTier
  /** Nome de uma custom property `--sport-*` (ver `src/lib/sports.ts`) para
   * sobrescrever a cor do dot por instância quando o contexto tem esporte
   * definido — ex. `sportCssVar="--sport-padel"`. Sem isto, o dot cai no
   * padrão `--interactive-primary`. */
  sportCssVar?: string
  className?: string
}

const TIER_LABEL: Record<TierChipTier, string> = {
  'pe-na-areia': 'Pé na Areia',
  D: 'D',
  C: 'C',
  B: 'B',
  A: 'A',
  'pro-open': 'Pro/Open',
}

/**
 * Selo do nível competitivo do atleta (Figma node 195:30, 6 símbolos: Pé na
 * Areia → Pro/Open). Informativo, não interativo — não use como filtro ou
 * seletor (para escolha use `Chip`/`Segmented`). Eixo independente de
 * `Medal`: o tier vem do desempenho em quadra, a medalha da frequência.
 */
export function TierChip({ tier, sportCssVar, className }: TierChipProps) {
  const label = TIER_LABEL[tier]
  const style = {
    '--tier-chip-dot-color': sportCssVar ? `var(${sportCssVar})` : 'var(--interactive-primary)',
  } as CSSProperties

  return (
    <span
      className={`tier-chip${className ? ` ${className}` : ''}`}
      style={style}
      role="img"
      aria-label={`Nível ${label}`}
    >
      <span className="tier-chip__dot" aria-hidden="true" />
      <span className="tier-chip__label" aria-hidden="true">
        {label}
      </span>
    </span>
  )
}
