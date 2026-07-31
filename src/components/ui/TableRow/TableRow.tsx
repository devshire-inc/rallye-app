import type { ReactNode } from 'react'
import './TableRow.css'

export interface TableRowProps {
  /** `<td>` cells composed by the caller — see Table / Documentation (Figma
   * node 239:382): "não existe um componente 'Table' fechado, a tabela é
   * composta na tela". This wrapper does not prescribe a column shape
   * (avatar/name/badge/action is only the doc's typical example). */
  children?: ReactNode
  hover?: boolean
  selected?: boolean
  className?: string
}

export function TableRow({ children, hover = false, selected = false, className }: TableRowProps) {
  const stateClass = selected ? 'table-row--selected' : hover ? 'table-row--hover' : 'table-row--default'
  return (
    <tr
      className={`table-row ${stateClass}${className ? ` ${className}` : ''}`}
      aria-selected={selected}
    >
      {children}
    </tr>
  )
}
