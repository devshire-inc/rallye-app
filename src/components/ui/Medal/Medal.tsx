import './Medal.css'

export type MedalTier = 'bronze' | 'prata' | 'ouro' | 'platina' | 'diamante'
export type MedalSize = 'sm' | 'md' | 'lg'
/** Pódio: 1º, 2º e 3º lugar. Só existem três — não é um número livre. */
export type MedalPlace = 1 | 2 | 3

export interface MedalTierProps {
  tier: MedalTier
  place?: never
  /** Small (32px) / Medium (48px) / Large (64px) — Figma node 196:32. */
  size?: MedalSize
  className?: string
}

export interface MedalPlaceProps {
  place: MedalPlace
  tier?: never
  /** A variante de posição é um glifo de texto, dimensionado pela tipografia
   * de quem a contém — `size` só existe no eixo de tier. */
  size?: never
  className?: string
}

export type MedalProps = MedalTierProps | MedalPlaceProps

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

const PLACE_GLYPH: Record<MedalPlace, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

/**
 * Selo de engajamento por frequência (Figma node 196:32, Tier=bronze..
 * diamante x Size=Small/Medium/Large). Eixo independente de `TierChip`: a
 * medalha reconhece constância, não desempenho.
 *
 * ## Dois eixos, um componente
 *
 * - `tier` (o original): círculo com a abreviação do tier, para o eixo de
 *   **constância** (`D1Dashboard`).
 * - `place` (1|2|3): as medalhas de **posição** do pódio, o eixo de
 *   *desempenho* — glifo 🥇/🥈/🥉 com `aria-label="1º lugar"`. Foi o gap que
 *   impediu Rankings de consumir o componente na primeira passada: o eixo de
 *   tier anuncia "Medalha Ouro", que não é o que uma coluna de classificação
 *   comunica. A variante de posição é deliberadamente um glifo inline (e não
 *   o círculo do tier): é o que os frames de Rankings desenham, e mantém a
 *   medalha alinhada à tipografia da linha que a contém.
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
export function Medal(props: MedalProps) {
  if (props.place !== undefined) {
    const { place, className } = props
    return (
      <span
        className={`medal medal--place medal--place-${place}${className ? ` ${className}` : ''}`}
        role="img"
        aria-label={`${place}º lugar`}
      >
        {PLACE_GLYPH[place]}
      </span>
    )
  }

  const { tier, size = 'sm', className } = props

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
