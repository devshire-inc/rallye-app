import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Badge } from './Badge'

describe('Badge', () => {
  it('renders its children as text', () => {
    render(<Badge tone="success">Confirmada</Badge>)
    expect(screen.getByText('Confirmada')).toBeInTheDocument()
  })

  it.each(['success', 'warning', 'danger', 'info', 'brand', 'neutral'] as const)(
    'renders without error for tone=%s',
    (tone) => {
      render(<Badge tone={tone}>Badge</Badge>)
      expect(screen.getByText('Badge')).toBeInTheDocument()
    },
  )

  it('applies the base and tone-specific class names', () => {
    render(<Badge tone="info">Confirmada</Badge>)
    const el = screen.getByText('Confirmada')
    expect(el.className).toContain('badge')
    expect(el.className).toContain('badge--info')
  })

  it('defaults to tone=neutral when no tone is given', () => {
    render(<Badge>Confirmada</Badge>)
    expect(screen.getByText('Confirmada').className).toContain('badge--neutral')
  })

  it('CSS: height, padding, border, radius, font per spec, no hex literals', () => {
    const css = readFileSync('src/components/ui/Badge/Badge.css', 'utf8')
    expect(css).toMatch(/height:\s*26px/)
    expect(css).toMatch(/padding:\s*0 var\(--space-3\)/)
    expect(css).toMatch(/border:\s*1px solid transparent/)
    expect(css).toMatch(/border-radius:\s*var\(--radius-pill\)/)
    expect(css).toMatch(/font:\s*var\(--type-label\)/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('CSS: tone mapping matches spec exactly, including the warning-text amendment', () => {
    const css = readFileSync('src/components/ui/Badge/Badge.css', 'utf8')
    expect(css).toMatch(/background:\s*var\(--state-success-soft\)/)
    expect(css).toMatch(/color:\s*var\(--state-success\)/)
    expect(css).toMatch(/background:\s*var\(--state-warning-soft\)/)
    expect(css).toMatch(/color:\s*var\(--state-warning-text\)/)
    expect(css).not.toMatch(/color:\s*var\(--state-warning\)[^-]/)
    expect(css).toMatch(/background:\s*var\(--state-danger-soft\)/)
    expect(css).toMatch(/color:\s*var\(--state-danger\)/)
    expect(css).toMatch(/background:\s*var\(--state-info-soft\)/)
    expect(css).toMatch(/color:\s*var\(--state-info\)/)
    expect(css).toMatch(/background:\s*var\(--surface-brand-soft\)/)
    expect(css).toMatch(/color:\s*var\(--text-brand\)/)
    expect(css).toMatch(/background:\s*var\(--surface-sunken\)/)
    expect(css).toMatch(/color:\s*var\(--text-muted\)/)
  })

  it('CSS: 5 semantic tones carry a tone-colored border, matching their soft-background text color; neutral has none', () => {
    const css = readFileSync('src/components/ui/Badge/Badge.css', 'utf8')
    expect(css).toMatch(/badge--success\s*{[^}]*border-color:\s*var\(--state-success\);/)
    expect(css).toMatch(/badge--warning\s*{[^}]*border-color:\s*var\(--state-warning-text\);/)
    expect(css).toMatch(/badge--danger\s*{[^}]*border-color:\s*var\(--state-danger\);/)
    expect(css).toMatch(/badge--info\s*{[^}]*border-color:\s*var\(--state-info\);/)
    expect(css).toMatch(/badge--brand\s*{[^}]*border-color:\s*var\(--interactive-primary-hover\);/)
    const neutralBlockMatch = css.match(/\.badge--neutral\s*{([^}]*)}/)
    expect(neutralBlockMatch).not.toBeNull()
    expect(neutralBlockMatch![1]).not.toMatch(/border-color/)
  })
})
