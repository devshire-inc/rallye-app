import type { CSSProperties, ReactNode } from 'react'
import { sportCssVar, sportLabel } from '../../../lib/sports'
import './SportTag.css'

export interface SportTagProps {
  sport: string
  solid?: boolean
  children?: ReactNode
}

/**
 * Pill de esporte na cor fixa do esporte (Figma node 27:45, "SportTag").
 * 6 esportes × soft (Solid=false, padrão — fundo 14% + texto na cor do
 * esporte) / solid (Solid=true — fundo sólido na cor do esporte + texto
 * on-brand). Sempre com um dot de 8px na frente do rótulo, na mesma cor
 * do texto.
 */
export function SportTag({ sport, solid = false, children }: SportTagProps) {
  const style = { '--tag-color': `var(${sportCssVar(sport)})` } as CSSProperties
  return (
    <span className={`sport-tag${solid ? ' sport-tag--solid' : ''}`} style={style}>
      <span className="sport-tag__dot" aria-hidden="true" />
      {children ?? sportLabel(sport)}
    </span>
  )
}
