import type { ReactNode } from 'react'
import './Pill.css'

export interface PillProps {
  children: ReactNode
  className?: string
}

/**
 * Pílula informativa de fundo tonal (Figma node 46:1085, ex.: "Verificar
 * E-mail" 43:1134). Usada para notas curtas dentro de telas de auth, como o
 * código de demonstração (`<b>DEMO</b> 123456`) nas telas de verificação —
 * o `<b>`/`<strong>` recebe o estilo Overline (rótulo), o restante do texto
 * fica no estilo mono do valor.
 */
export function Pill({ children, className }: PillProps) {
  return <span className={`pill${className ? ` ${className}` : ''}`}>{children}</span>
}
