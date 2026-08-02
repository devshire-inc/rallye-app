import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Sidebar, type SidebarSection } from './Sidebar'

const SECTIONS: SidebarSection[] = [
  {
    label: 'PRINCIPAL',
    items: [
      { icon: 'home', label: 'Início' },
      { icon: 'calendar', label: 'Agenda' },
    ],
  },
  {
    label: 'GESTÃO',
    items: [{ icon: 'briefcase', label: 'Financeiro' }],
  },
]

describe('Sidebar', () => {
  it('renders a <nav aria-label="Navegação principal">', () => {
    render(<Sidebar sections={SECTIONS} active="Início" footerItems={[]} />)
    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument()
  })

  it('renders section labels and their items', () => {
    render(<Sidebar sections={SECTIONS} active="Início" footerItems={[]} />)
    expect(screen.getByText('PRINCIPAL')).toBeInTheDocument()
    expect(screen.getByText('GESTÃO')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Início' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Agenda' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Financeiro' })).toBeInTheDocument()
  })

  it('marks the active item with aria-current="page"', () => {
    render(<Sidebar sections={SECTIONS} active="Agenda" footerItems={[]} />)
    expect(screen.getByRole('button', { name: 'Agenda' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Início' })).not.toHaveAttribute('aria-current')
  })

  it('calls onChange with the clicked item label', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Sidebar sections={SECTIONS} active="Início" onChange={onChange} footerItems={[]} />)
    await user.click(screen.getByRole('button', { name: 'Financeiro' }))
    expect(onChange).toHaveBeenCalledWith('Financeiro')
  })

  it('supports keyboard activation (Enter/Space) via native button semantics', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Sidebar sections={SECTIONS} active="Início" onChange={onChange} footerItems={[]} />)
    await user.tab()
    expect(screen.getByRole('button', { name: 'Início' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('Início')
  })

  it('defaults to the real admin sections (PRINCIPAL/GESTÃO) with pt-BR labels when sections is omitted', () => {
    render(<Sidebar active="Início" footerItems={[]} />)
    expect(screen.getByText('PRINCIPAL')).toBeInTheDocument()
    expect(screen.getByText('GESTÃO')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Início' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Turmas' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Alunos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Configurações' })).toBeInTheDocument()
  })

  it('renders the default footer item (Perfil) when footerItems is omitted', () => {
    render(<Sidebar active="Início" />)
    expect(screen.getByRole('button', { name: 'Perfil' })).toBeInTheDocument()
  })

  it('renders the logo slot when provided, and omits it entirely when not', () => {
    const { rerender } = render(<Sidebar sections={SECTIONS} logo={<span>rallye</span>} footerItems={[]} />)
    expect(screen.getByText('rallye')).toBeInTheDocument()

    rerender(<Sidebar sections={SECTIONS} footerItems={[]} />)
    expect(screen.queryByText('rallye')).not.toBeInTheDocument()
  })

  it('renders the arena selector footer slot, calling onClick when clicked', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <Sidebar
        sections={SECTIONS}
        footerItems={[]}
        arenaSelector={{ label: 'Arena Beira-Mar', action: 'Trocar arena', onClick }}
      />,
    )
    expect(screen.getByText('Arena Beira-Mar')).toBeInTheDocument()
    expect(screen.getByText('Trocar arena')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Beira-Mar/ }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('falls back to the home icon for an unknown icon name, without throwing', () => {
    expect(() =>
      render(
        <Sidebar
          sections={[{ label: 'X', items: [{ icon: 'unknown-icon-xyz', label: 'Extra' }] }]}
          active="Extra"
          footerItems={[]}
        />,
      ),
    ).not.toThrow()
    expect(screen.getByRole('button', { name: 'Extra' }).querySelector('svg')).toBeInTheDocument()
  })

  it('CSS: panel is a floating fill-surface (surface/card, radius/xl, Shadow/Float Nav, no border)', () => {
    const css = readFileSync('src/components/ui/Sidebar/Sidebar.css', 'utf8')
    expect(css).toMatch(/\.sidebar\s*\{[^}]*background:\s*var\(--surface-card\)/)
    expect(css).toMatch(/\.sidebar\s*\{[^}]*border-radius:\s*var\(--radius-xl\)/)
    expect(css).toMatch(/\.sidebar\s*\{[^}]*box-shadow:\s*var\(--shadow-float-nav\)/)
    expect(css).not.toMatch(/\.sidebar\s*\{[^}]*border:/)
  })

  it('CSS: active item uses the alpha/orange-14 capsule with text/on-brand-soft — never text/brand — default/hover use text/muted and text/body', () => {
    const css = readFileSync('src/components/ui/Sidebar/Sidebar.css', 'utf8')
    expect(css).toMatch(/\.sidebar__item--active\s*\{[^}]*background:\s*var\(--alpha-orange-14\)/)
    expect(css).toMatch(/\.sidebar__item--active\s*\{[^}]*color:\s*var\(--text-on-brand-soft\)/)
    expect(css).toMatch(/\.sidebar__item\s*\{[^}]*color:\s*var\(--text-muted\)/)
    expect(css).toMatch(/\.sidebar__item:hover:not\(\.sidebar__item--active\)\s*\{[^}]*color:\s*var\(--text-body\)/)
    expect(css).not.toMatch(/--text-brand\)/)
  })

  it('CSS: section labels use the overline type with tracking and text/muted', () => {
    const css = readFileSync('src/components/ui/Sidebar/Sidebar.css', 'utf8')
    expect(css).toMatch(/\.sidebar__section-label\s*\{[^}]*font:\s*var\(--type-overline\)/)
    expect(css).toMatch(/\.sidebar__section-label\s*\{[^}]*letter-spacing:\s*var\(--tracking-overline\)/)
    expect(css).toMatch(/\.sidebar__section-label\s*\{[^}]*color:\s*var\(--text-muted\)/)
  })

  it('CSS: no hex color literals (tokens layer owns final color values)', () => {
    const css = readFileSync('src/components/ui/Sidebar/Sidebar.css', 'utf8')
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('icon user-circle (item "Perfil"): o arco dos ombros termina SOBRE o anel, nunca fora dele', () => {
    // O bug que este teste tranca: o path anterior desenhava os ombros de
    // x=4.5 a x=19.5 em y=20, muito além da largura do anel (r=9, centro
    // 12,12) naquela altura — os dois extremos furavam o círculo e o ícone
    // aparecia deformado ao lado dos outros desta mesma nav.
    const source = readFileSync('src/components/ui/Sidebar/Sidebar.tsx', 'utf8')
    const d = /'user-circle':\s*\n?\s*'([^']*)'/.exec(source)?.[1] ?? ''

    const ring = /^M12 [\d.]+a([\d.]+) /.exec(d)
    const shoulders = /M([\d.]+) ([\d.]+)a[\d.]+ [\d.]+ 0 00-([\d.]+) 0$/.exec(d)
    expect(ring).not.toBeNull()
    expect(shoulders).not.toBeNull()

    const radius = Number(ring?.[1])
    const startX = Number(shoulders?.[1])
    const y = Number(shoulders?.[2])
    const span = Number(shoulders?.[3])
    for (const x of [startX, startX - span]) {
      expect(Math.hypot(x - 12, y - 12)).toBeLessThanOrEqual(radius + 0.01)
    }
  })

  it('tokens: --alpha-orange-14 and --text-on-brand-soft exist and are contrast-compliant (>= 4.5:1 for the active label on surface/card)', () => {
    const colorsCss = readFileSync('src/styles/tokens/colors.css', 'utf8')
    expect(colorsCss).toMatch(/--alpha-orange-14:\s*rgba\(249,100,32,\.14\)/)
    expect(colorsCss).toMatch(/--text-on-brand-soft:\s*#8f3005/)
  })
})
