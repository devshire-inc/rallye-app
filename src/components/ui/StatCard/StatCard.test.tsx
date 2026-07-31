import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatCard } from './StatCard'

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Reservas hoje" value="12" />)
    expect(screen.getByText('Reservas hoje')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('renders delta with the given tone', () => {
    render(<StatCard label="Faturamento" value="R$ 1.200" delta="+8%" deltaTone="success" />)
    expect(screen.getByText('+8%')).toBeInTheDocument()
  })

  it('renders without a delta when none is given', () => {
    const { container } = render(<StatCard label="Reservas hoje" value="12" />)
    expect(container.querySelector('.stat-card__delta')).not.toBeInTheDocument()
  })

  it('never renders a <button> — it is standalone', () => {
    const { container } = render(<StatCard label="Reservas hoje" value="12" delta="+8%" />)
    expect(container.querySelector('button')).not.toBeInTheDocument()
  })

  it('CSS: label uses --type-label, no hex literals', () => {
    const css = readFileSync('src/components/ui/StatCard/StatCard.css', 'utf8')
    expect(css).toMatch(/\.stat-card__label\s*\{[^}]*font:\s*var\(--type-label\)/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('CSS: value uses --type-score (Baloo 2 ExtraBold 28px, matches Figma node 42:31)', () => {
    const css = readFileSync('src/components/ui/StatCard/StatCard.css', 'utf8')
    expect(css).toMatch(/\.stat-card__value\s*\{[^}]*font:\s*var\(--type-score\)/)
  })

  it('CSS: delta tones use the state text colors (success-text/danger-text), not the base state colors', () => {
    const css = readFileSync('src/components/ui/StatCard/StatCard.css', 'utf8')
    expect(css).toMatch(/\.stat-card__delta--success\s*\{[^}]*color:\s*var\(--state-success-text\)/)
    expect(css).toMatch(/\.stat-card__delta--danger\s*\{[^}]*color:\s*var\(--state-danger-text\)/)
  })
})
