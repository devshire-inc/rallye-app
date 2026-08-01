import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TableRow } from './TableRow'

describe('TableRow', () => {
  it('renders a real <tr>, not a simulated div', () => {
    render(
      <table>
        <tbody>
          <TableRow>
            <td>Bruno Fernandes</td>
          </TableRow>
        </tbody>
      </table>,
    )
    const row = screen.getByText('Bruno Fernandes').closest('tr')
    expect(row?.tagName).toBe('TR')
  })

  it('composes real <td> children rather than prescribing fixed columns', () => {
    render(
      <table>
        <tbody>
          <TableRow>
            <td>Coluna A</td>
            <td>Coluna B</td>
            <td>Coluna C</td>
          </TableRow>
        </tbody>
      </table>,
    )
    expect(screen.getByText('Coluna A')).toBeInTheDocument()
    expect(screen.getByText('Coluna B')).toBeInTheDocument()
    expect(screen.getByText('Coluna C')).toBeInTheDocument()
  })

  it('omits aria-selected entirely when the row is not selectable (default)', () => {
    // `aria-selected` não é suportado em `role="row"` fora de grid/treegrid:
    // emitir "false" em toda linha de toda tabela estática é ARIA inválido.
    render(
      <table>
        <tbody>
          <TableRow>
            <td>Linha</td>
          </TableRow>
        </tbody>
      </table>,
    )
    const row = screen.getByText('Linha').closest('tr')!
    expect(row).not.toHaveAttribute('aria-selected')
    expect(row.className).toContain('table-row--default')
  })

  it('emits aria-selected="false" when the row is selectable but not selected', () => {
    render(
      <table role="grid">
        <tbody>
          <TableRow selected={false}>
            <td>Linha</td>
          </TableRow>
        </tbody>
      </table>,
    )
    const row = screen.getByText('Linha').closest('tr')!
    expect(row).toHaveAttribute('aria-selected', 'false')
    expect(row.className).toContain('table-row--default')
  })

  it('applies the hover-state class when hover is true', () => {
    render(
      <table>
        <tbody>
          <TableRow hover>
            <td>Linha</td>
          </TableRow>
        </tbody>
      </table>,
    )
    expect(screen.getByText('Linha').closest('tr')!.className).toContain('table-row--hover')
  })

  it('applies aria-selected="true" and the selected-state class when selected is true', () => {
    render(
      <table role="grid">
        <tbody>
          <TableRow selected>
            <td>Linha</td>
          </TableRow>
        </tbody>
      </table>,
    )
    const row = screen.getByText('Linha').closest('tr')!
    expect(row).toHaveAttribute('aria-selected', 'true')
    expect(row.className).toContain('table-row--selected')
  })

  it('selected takes precedence over hover when both are passed', () => {
    render(
      <table>
        <tbody>
          <TableRow hover selected>
            <td>Linha</td>
          </TableRow>
        </tbody>
      </table>,
    )
    const row = screen.getByText('Linha').closest('tr')!
    expect(row.className).toContain('table-row--selected')
    expect(row.className).not.toContain('table-row--hover')
  })

  it('CSS: selected state carries both the soft background AND the 3px left accent bar (never bg-only)', () => {
    const css = readFileSync('src/components/ui/TableRow/TableRow.css', 'utf8')
    expect(css).toMatch(/\.table-row--selected\s*{[^}]*background:\s*var\(--surface-brand-soft\);/)
    expect(css).toMatch(
      /\.table-row--selected\s*{[^}]*border-left-color:\s*var\(--interactive-primary\);/,
    )
    expect(css).toMatch(/border-left:\s*3px solid transparent/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('CSS: default and hover states use their spec surfaces', () => {
    const css = readFileSync('src/components/ui/TableRow/TableRow.css', 'utf8')
    expect(css).toMatch(/\.table-row--default\s*{[^}]*background:\s*var\(--surface-card\);/)
    expect(css).toMatch(/\.table-row--hover\s*{[^}]*background:\s*var\(--surface-sunken\);/)
  })
})
