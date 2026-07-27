import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BottomNav } from './BottomNav'

const ITEMS = [
  { icon: 'home', label: 'Início' },
  { icon: 'agenda', label: 'Agenda' },
  { icon: 'ranking', label: 'Ranking' },
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
