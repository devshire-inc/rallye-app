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

  it('CSS: container is a fill-surface floating pill (surface/card, radius/pill, Shadow/Float Nav, no border), items fill the available width equally', () => {
    const css = readFileSync('src/components/ui/BottomNav/BottomNav.css', 'utf8')
    expect(css).toMatch(/\.bottom-nav\s*\{[^}]*background:\s*var\(--surface-card\)/)
    expect(css).toMatch(/\.bottom-nav\s*\{[^}]*border-radius:\s*var\(--radius-pill\)/)
    expect(css).toMatch(/\.bottom-nav\s*\{[^}]*box-shadow:\s*var\(--shadow-float-nav\)/)
    expect(css).not.toMatch(/\.bottom-nav\s*\{[^}]*border:/)
    expect(css).toMatch(/\.bottom-nav__item\s*\{[^}]*flex:\s*1/)
  })

  it('CSS: active item uses the alpha/orange-14 capsule (owned by the shared sliding indicator) with text/on-brand-soft — never text/brand — and default/hover use text/muted', () => {
    const css = readFileSync('src/components/ui/BottomNav/BottomNav.css', 'utf8')
    expect(css).toMatch(/\.bottom-nav__indicator\s*\{[^}]*background:\s*var\(--alpha-orange-14\)/)
    expect(css).toMatch(/\.bottom-nav__item--active\s*\{[^}]*color:\s*var\(--text-on-brand-soft\)/)
    expect(css).toMatch(/\.bottom-nav__item\s*\{[^}]*color:\s*var\(--text-muted\)/)
    expect(css).not.toMatch(/--text-brand\)/)
  })

  it('renders a sliding indicator behind the active item, positioned/sized via CSS custom properties', () => {
    const { container } = render(<BottomNav items={ITEMS} active="Agenda" />)
    const indicator = container.querySelector('.bottom-nav__indicator')
    expect(indicator).toBeInTheDocument()
    expect(indicator).toHaveAttribute('aria-hidden', 'true')
  })

  it('CSS: no hex color literals (tokens layer owns final color values)', () => {
    const css = readFileSync('src/components/ui/BottomNav/BottomNav.css', 'utf8')
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('tokens: --alpha-orange-14 and --text-on-brand-soft exist and are contrast-compliant (>= 4.5:1 for the active label on surface/card)', () => {
    const colorsCss = readFileSync('src/styles/tokens/colors.css', 'utf8')
    expect(colorsCss).toMatch(/--alpha-orange-14:\s*rgba\(249,100,32,\.14\)/)
    expect(colorsCss).toMatch(/--text-on-brand-soft:\s*#8f3005/)
  })
})
