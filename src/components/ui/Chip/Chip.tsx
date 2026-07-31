import type { CSSProperties, ReactNode } from 'react'
import './Chip.css'

export interface ChipProps {
  label?: string
  children?: ReactNode
  selected?: boolean
  onToggle?: (selected: boolean) => void
  dot?: boolean
  dotColor?: string
  className?: string
}

/**
 * Pill de filtro/alternância (Figma node 98:2, variantes 98:16). Usado para
 * filtros de esporte, dias da semana e seleção de quadra — cada Chip alterna
 * de forma independente (não é um grupo de escolha única como Segmented/Tabs).
 * HasDot=true mostra um ponto de cor à frente do rótulo; a cor é
 * caller-supplied via `dotColor` (ex: `var(${sportCssVar(sport)})`) já que
 * este primitivo não conhece esportes/quadras. Quando selecionado, o dot
 * sempre vira --text-on-brand (branco) para manter contraste sobre o fundo
 * sólido --interactive-primary, independente da cor fornecida.
 */
export function Chip({
  label,
  children,
  selected = false,
  onToggle,
  dot = false,
  dotColor,
  className,
}: ChipProps) {
  const style = { '--chip-dot-color': dotColor ?? 'var(--interactive-primary)' } as CSSProperties

  return (
    <button
      type="button"
      className={`chip${selected ? ' chip--selected' : ''}${className ? ` ${className}` : ''}`}
      style={style}
      aria-pressed={selected}
      onClick={() => onToggle?.(!selected)}
    >
      {dot && <span className="chip__dot" aria-hidden="true" />}
      <span className="chip__label">{children ?? label}</span>
    </button>
  )
}
