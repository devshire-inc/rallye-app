import './AvatarBadge.css'
import whistleIcon from './icons/whistle.svg'
import shieldIcon from './icons/shield.svg'

export type AvatarBadgeType = 'professor' | 'admin' | 'bronze' | 'prata' | 'ouro' | 'platina' | 'diamante'

export interface AvatarBadgeProps {
  type?: AvatarBadgeType
  /** Rótulo por extenso para leitores de tela — ex. "Professor",
   * "Administrador", "Medalha Ouro". Nunca a sigla ("Pt") nem o nome do
   * ícone: obrigatório, sem default, ver Figma node 24:3,
   * "ACESSIBILIDADE". */
  label: string
}

const TIER_LETTER: Record<'bronze' | 'prata' | 'ouro' | 'platina' | 'diamante', string> = {
  bronze: 'B',
  prata: 'P',
  ouro: 'O',
  platina: 'Pt',
  diamante: 'D',
}

/**
 * Selo de papel ou tier (Figma node 258:742), aninhado no canto superior
 * direito de `<Avatar badge={...} />`. PAPEL (Professor/Admin) usa ícone;
 * TIER (Bronze..Diamante) usa letra — a distinção é de forma, não só de
 * cor, para não depender de percepção de cor (ver node 24:3).
 */
export function AvatarBadge({ type = 'professor', label }: AvatarBadgeProps) {
  return (
    <span className={`avatar-badge avatar-badge--${type}`} role="img" aria-label={label}>
      {type === 'professor' ? (
        <img className="avatar-badge__icon" src={whistleIcon} alt="" aria-hidden="true" />
      ) : type === 'admin' ? (
        <img className="avatar-badge__icon" src={shieldIcon} alt="" aria-hidden="true" />
      ) : (
        <span className="avatar-badge__letter" aria-hidden="true">
          {TIER_LETTER[type]}
        </span>
      )}
    </span>
  )
}
