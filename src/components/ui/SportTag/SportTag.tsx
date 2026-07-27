import type { CSSProperties, ReactNode } from 'react'
import { sportCssVar, sportLabel } from '../../../lib/sports'
import './SportTag.css'

export interface SportTagProps {
  sport: string
  solid?: boolean
  children?: ReactNode
}

export function SportTag({ sport, solid = false, children }: SportTagProps) {
  const style = { '--tag-color': `var(${sportCssVar(sport)})` } as CSSProperties
  return (
    <span className={`sport-tag${solid ? ' sport-tag--solid' : ''}`} style={style}>
      {children ?? sportLabel(sport)}
    </span>
  )
}
