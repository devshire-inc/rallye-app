import type { CSSProperties, ReactNode } from 'react'
import './Avatar.css'
import fallbackHead from './icons/fallback-head.svg'
import fallbackBody from './icons/fallback-body.svg'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface AvatarProps {
  name?: string
  size?: AvatarSize
  src?: string
  /** Selo de presença/status no canto inferior direito — normalmente um
   * `<AvatarIndicator />`. Passado como prop (não como children soltos),
   * ver Figma node 258:557: "Use aninhado dentro de Avatar (prop
   * Indicator) ou solto em listas de chamada." */
  indicator?: ReactNode
  /** Selo de papel/tier no canto superior direito — normalmente um
   * `<AvatarBadge />`. Indicator e Badge ficam em cantos opostos e podem
   * coexistir a partir de Medium; evite combinar os dois em XSmall/Small
   * (Figma node 24:3, "QUANDO NÃO USAR": não há área para os dois e eles
   * cobrem as iniciais). */
  badge?: ReactNode
}

const AVATAR_COLOR_TOKENS = [
  '--sport-beach-tennis',
  '--sport-padel',
  '--sport-futevolei',
  '--sport-volei',
  '--sport-tenis',
] as const

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return (words[0]![0] + words[1]![0]).toUpperCase()
}

function colorTokenFor(name: string): (typeof AVATAR_COLOR_TOKENS)[number] {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash + name.charCodeAt(i)) % AVATAR_COLOR_TOKENS.length
  }
  return AVATAR_COLOR_TOKENS[hash]!
}

export function Avatar({ name, size = 'md', src, indicator, badge }: AvatarProps) {
  const trimmedName = name?.trim()

  let modeClass: string
  let content: ReactNode
  let wrapperStyle: CSSProperties | undefined

  if (src) {
    modeClass = 'avatar--photo'
    content = <img className="avatar__photo" src={src} alt={trimmedName ?? ''} />
  } else if (trimmedName) {
    modeClass = 'avatar--initials'
    // --avatar-color must live on the wrapper span, not this inner one:
    // .avatar--initials' `background` rule reads it from its own element,
    // and custom properties only cascade down to descendants, never up.
    wrapperStyle = { '--avatar-color': `var(${colorTokenFor(trimmedName)})` } as CSSProperties
    content = (
      <span className="avatar__initials" role="img" aria-label={trimmedName}>
        {initialsOf(trimmedName)}
      </span>
    )
  } else {
    // Sem nome e sem foto: silhueta genérica neutra (Figma HasFallbackIcon)
    // — usuário sem nome não tem identidade de esporte, então não usa as
    // cores sport/*.
    modeClass = 'avatar--fallback'
    content = (
      <span className="avatar__fallback" aria-hidden="true">
        <img className="avatar__fallback-head" src={fallbackHead} alt="" />
        <img className="avatar__fallback-body" src={fallbackBody} alt="" />
      </span>
    )
  }

  return (
    <span className={`avatar avatar--${size} ${modeClass}`} style={wrapperStyle}>
      <span className="avatar__clip">{content}</span>
      {indicator ? <span className="avatar__indicator">{indicator}</span> : null}
      {badge ? <span className="avatar__badge">{badge}</span> : null}
    </span>
  )
}
