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

  it('CSS: height, padding, radius, font per spec, no hex literals', () => {
    const css = readFileSync('src/components/ui/Badge/Badge.css', 'utf8')
    expect(css).toMatch(/height:\s*26px/)
    expect(css).toMatch(/padding:\s*0 12px/)
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
})
