import type { CSSProperties, ReactNode } from 'react'
import './Card.css'

/**
 * Quando interactive, Card renderiza button — NUNCA aninhe outro elemento
 * interativo como descendente.
 */
export type CardProps =
  | { interactive?: false; onClick?: never; padding?: number | string; children?: ReactNode }
  | { interactive: true; onClick: () => void; padding?: number | string; children?: ReactNode }

export function Card(props: CardProps) {
  const { padding = 20, children } = props
  const style = {
    '--card-padding': typeof padding === 'number' ? `${padding}px` : padding,
  } as CSSProperties

  if (props.interactive) {
    return (
      <button
        type="button"
        className="card card--interactive"
        style={style}
        onClick={props.onClick}
      >
        {children}
      </button>
    )
  }

  return (
    <div className="card" style={style}>
      {children}
    </div>
  )
}
