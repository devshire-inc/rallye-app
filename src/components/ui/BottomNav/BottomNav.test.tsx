import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BottomNav } from './BottomNav'

const ITEMS = [
  { icon: 'home', label: 'Início' },
  { icon: 'calendar', label: 'Agenda' },
  { icon: 'trophy', label: 'Ranking' },
]

describe('BottomNav', () => {
  it('renders a <nav aria-label="Navegação principal">', () => {
    render(<BottomNav items={ITEMS} active="Início" />)
    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument()
  })

  it('marks the active item with aria-current="page"', () => {
    render(<BottomNav items={ITEMS} active="Agenda" />)
    expect(screen.getByRole('button', { name: 'Agenda' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Início' })).not.toHaveAttribute('aria-current')
  })

  it('calls onChange with the clicked label', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<BottomNav items={ITEMS} active="Início" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Ranking' }))
    expect(onChange).toHaveBeenCalledWith('Ranking')
  })

  it('defaults to the 5 real items (home/calendar/trophy/bag/user) with pt-BR labels when items is omitted', () => {
    render(<BottomNav active="Início" />)
    expect(screen.getByRole('button', { name: 'Início' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agenda' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Torneios' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Loja' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Perfil' })).toBeInTheDocument()
  })

  it('uses the exact SVG path data from the real Claude Design source for each icon key', () => {
    const source = readFileSync('src/components/ui/BottomNav/BottomNav.tsx', 'utf8')
    expect(source).toMatch(/M3 11l9-8 9 8v9a2 2 0 01-2 2h-4v-7h-6v7H5a2 2 0 01-2-2z/)
    expect(source).toMatch(
      /M8 2v4M16 2v4M3 9h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z/,
    )
    expect(source).toMatch(
      /M8 21h8M12 17v4M7 4h10v6a5 5 0 01-10 0zM7 6H4a1 1 0 00-1 1 4 4 0 004 4M17 6h3a1 1 0 011 1 4 4 0 01-4 4/,
    )
    expect(source).toMatch(/M6 7h12l1 14H5zM9 7a3 3 0 016 0/)
    expect(source).toMatch(/M20 21a8 8 0 00-16 0M12 13a4 4 0 100-8 4 4 0 000 8z/)
  })

  it('falls back to the home icon for an unknown icon name, without throwing', () => {
    expect(() =>
      render(<BottomNav items={[{ icon: 'unknown-icon-xyz', label: 'Extra' }]} active="Extra" />),
    ).not.toThrow()
    expect(screen.getByRole('button', { name: 'Extra' }).querySelector('svg')).toBeInTheDocument()
  })

  it('CSS: container/active/inactive tokens per spec, active uses --text-on-brand, no hex literals', () => {
    const css = readFileSync('src/components/ui/BottomNav/BottomNav.css', 'utf8')
    expect(css).toMatch(/background:\s*var\(--surface-inverse\)/)
    expect(css).toMatch(/border-radius:\s*var\(--radius-pill\)/)
    expect(css).toMatch(/box-shadow:\s*var\(--shadow-float-nav\)/)
    expect(css).toMatch(/background:\s*var\(--interactive-primary\)/)
    expect(css).toMatch(/color:\s*var\(--text-on-brand\)/)
    expect(css).toMatch(/color:\s*var\(--text-inverse\)/)
    expect(css).toMatch(/opacity:\s*0?\.8/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
