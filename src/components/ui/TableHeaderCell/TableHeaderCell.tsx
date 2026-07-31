import type { ReactNode } from 'react'
import './TableHeaderCell.css'

export interface TableHeaderCellProps {
  children?: ReactNode
  /** Larguras variam por coluna na tela real; a métrica 160×40 do Figma é
   * só a referência do símbolo — largura fica a cargo do `<col>`/layout da
   * tabela composta pelo caller. */
  className?: string
}

export function TableHeaderCell({ children, className }: TableHeaderCellProps) {
  return (
    <th scope="col" className={`table-header-cell${className ? ` ${className}` : ''}`}>
      {children}
    </th>
  )
}
