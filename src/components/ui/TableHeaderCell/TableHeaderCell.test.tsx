import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TableHeaderCell } from './TableHeaderCell'

describe('TableHeaderCell', () => {
  it('renders a real <th scope="col">, not a simulated div', () => {
    render(
      <table>
        <thead>
          <tr>
            <TableHeaderCell>Nome</TableHeaderCell>
          </tr>
        </thead>
      </table>,
    )
    const th = screen.getByRole('columnheader', { name: 'Nome' })
    expect(th.tagName).toBe('TH')
    expect(th).toHaveAttribute('scope', 'col')
  })

  it('renders its children as the label', () => {
    render(
      <table>
        <thead>
          <tr>
            <TableHeaderCell>E-mail</TableHeaderCell>
          </tr>
        </thead>
      </table>,
    )
    expect(screen.getByText('E-mail')).toBeInTheDocument()
  })

  it('merges a caller-supplied className with the base class', () => {
    render(
      <table>
        <thead>
          <tr>
            <TableHeaderCell className="col-name">Nome</TableHeaderCell>
          </tr>
        </thead>
      </table>,
    )
    const th = screen.getByRole('columnheader')
    expect(th.className).toContain('table-header-cell')
    expect(th.className).toContain('col-name')
  })

  it('CSS: sunken bg, 1.5px bottom border, overline label in muted text, no hex literals', () => {
    const css = readFileSync('src/components/ui/TableHeaderCell/TableHeaderCell.css', 'utf8')
    expect(css).toMatch(/background:\s*var\(--surface-sunken\)/)
    expect(css).toMatch(/border-bottom:\s*1\.5px solid var\(--border-default\)/)
    expect(css).toMatch(/font:\s*var\(--type-overline\)/)
    expect(css).toMatch(/color:\s*var\(--text-muted\)/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
