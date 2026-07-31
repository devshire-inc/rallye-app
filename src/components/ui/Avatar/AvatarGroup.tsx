import { Avatar } from './Avatar'
import './AvatarGroup.css'

export type AvatarGroupSize = 'sm' | 'md' | 'lg'

export interface AvatarGroupMember {
  name: string
  src?: string
}

export interface AvatarGroupProps {
  members: AvatarGroupMember[]
  size?: AvatarGroupSize
  /** Quantos avatares cabem antes de colapsar em "+N" — default 4, igual
   * ao frame do Figma (3 avatares + o 4º slot virando overflow). */
  max?: number
  /** Chamado ao clicar/ativar o chip "+N" — tipicamente abre a lista
   * completa de participantes (ver Figma node 24:3, "ACESSIBILIDADE": o
   * "+N" precisa ser focável e abrir a lista completa). */
  onOverflowClick?: () => void
}

/**
 * Pilha de avatares sobrepostos (Figma node 258:2025) — alunos de uma
 * turma, duplas, inscritos em torneio. Overlap de -28% da largura de cada
 * avatar; Overflow=true troca o avatar excedente por um contador "+N".
 *
 * Renderiza como uma lista (`<ul>`) para expor o nome de cada participante
 * via o `aria-label`/`alt` que o próprio `<Avatar>` já carrega — a
 * exigência de acessibilidade do Figma ("exponha uma lista com todos os
 * nomes") fica satisfeita pela estrutura, sem duplicar texto.
 */
export function AvatarGroup({ members, size = 'sm', max = 4, onOverflowClick }: AvatarGroupProps) {
  const hasOverflow = members.length > max
  const visibleMembers = hasOverflow ? members.slice(0, max - 1) : members.slice(0, max)
  const overflowCount = hasOverflow ? members.length - visibleMembers.length : 0

  return (
    <ul className={`avatar-group avatar-group--${size}`}>
      {visibleMembers.map((member, index) => (
        <li key={`${member.name}-${index}`} className="avatar-group__item">
          <Avatar name={member.name} src={member.src} size={size} />
        </li>
      ))}
      {overflowCount > 0 ? (
        <li className="avatar-group__item">
          <button
            type="button"
            className="avatar-group__overflow"
            aria-label={`mais ${overflowCount} participantes`}
            onClick={onOverflowClick}
          >
            +{overflowCount}
          </button>
        </li>
      ) : null}
    </ul>
  )
}
