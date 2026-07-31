import './Medal.css'

export type MedalTier = 'bronze' | 'prata' | 'ouro' | 'platina' | 'diamante'
export type MedalSize = 'sm' | 'md' | 'lg'

export interface MedalProps {
  tier: MedalTier
  /** Small (32px) / Medium (48px) / Large (64px) — Figma node 196:32. */
  size?: MedalSize
  className?: string
}

const TIER_LETTER: Record<MedalTier, string> = {
  bronze: 'B',
  prata: 'P',
  ouro: 'O',
  platina: 'Pt',
  diamante: 'D',
}

const TIER_NAME: Record<MedalTier, string> = {
  bronze: 'Bronze',
  prata: 'Prata',
  ouro: 'Ouro',
  platina: 'Platina',
  diamante: 'Diamante',
}

/**
 * Selo de engajamento por frequência (Figma node 196:32, Tier=bronze..
 * diamante x Size=Small/Medium/Large). Eixo independente de `TierChip`: a
 * medalha reconhece constância, não desempenho.
 *
 * Contraste: usa `gamification/{tier}-soft` só como decoração de fundo (é o
 * "efeito metal" — tinta clara, nunca passa em contraste sozinha). O
 * contorno e a abreviação central carregam a forma e a informação de
 * verdade, em `gamification/{tier}-strong`/`-text` (degrau escuro, 3:1+ /
 * 4,5:1+). NUNCA o token base `gamification/{tier}` aqui — esse é
 * mode-invariant e existe só para preenchimento sólido com glifo branco
 * (`AvatarBadge`); como stroke ou texto sobre o -soft ele falha contraste
 * (platina 1,40:1, ouro 1,75:1, prata 1,92:1 no Light).
 */
export function Medal({ tier, size = 'sm', className }: MedalProps) {
  return (
    <span
      className={`medal medal--${tier} medal--${size}${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={`Medalha ${TIER_NAME[tier]}`}
    >
      <span className="medal__letter" aria-hidden="true">
        {TIER_LETTER[tier]}
      </span>
    </span>
  )
}
