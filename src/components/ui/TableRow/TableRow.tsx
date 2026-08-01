import type { ReactNode } from 'react'
import './TableRow.css'

export interface TableRowProps {
  /** `<td>` cells composed by the caller — see Table / Documentation (Figma
   * node 239:382): "não existe um componente 'Table' fechado, a tabela é
   * composta na tela". This wrapper does not prescribe a column shape
   * (avatar/name/badge/action is only the doc's typical example). */
  children?: ReactNode
  hover?: boolean
  /** Estado de seleção da linha — e também o que decide se `aria-selected`
   * é emitido:
   *
   * - `undefined` (padrão): tabela ESTÁTICA, linha não selecionável, nenhum
   *   `aria-selected` no `<tr>`. É o caso da maioria das telas (listagens
   *   que só navegam pelo controle da célula de ação). `aria-selected` não
   *   é suportado em `role="row"` fora de `grid`/`treegrid` — emiti-lo aqui
   *   seria ARIA inválido, replicado em toda linha de toda tela.
   * - `false`/`true`: linha SELECIONÁVEL — o atributo é emitido com o valor
   *   correspondente. Só use nesse caso, e então a `<table>` que a contém
   *   precisa expor `role="grid"` pra que o atributo seja válido. */
  selected?: boolean
  className?: string
}

export function TableRow({ children, hover = false, selected, className }: TableRowProps) {
  const stateClass = selected
    ? 'table-row--selected'
    : hover
      ? 'table-row--hover'
      : 'table-row--default'
  return (
    <tr
      className={`table-row ${stateClass}${className ? ` ${className}` : ''}`}
      // `undefined` faz o React OMITIR o atributo (não renderiza
      // `aria-selected="undefined"`) — é o que mantém a tabela estática
      // livre de ARIA inválido. Ver o doc da prop `selected`.
      aria-selected={selected}
    >
      {children}
    </tr>
  )
}
