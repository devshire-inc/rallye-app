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

  it('never renders a <button> — it is standalone', () => {
    const { container } = render(<StatCard label="Reservas hoje" value="12" delta="+8%" />)
    expect(container.querySelector('button')).not.toBeInTheDocument()
  })

  it('CSS: label uses --type-overline, uppercase and --tracking-overline; no hex literals', () => {
    const css = readFileSync('src/components/ui/StatCard/StatCard.css', 'utf8')
    expect(css).toMatch(/font:\s*var\(--type-overline\)/)
    expect(css).toMatch(/text-transform:\s*uppercase/)
    expect(css).toMatch(/letter-spacing:\s*var\(--tracking-overline\)/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('CSS: value uses 800 30px var(--font-display)', () => {
    const css = readFileSync('src/components/ui/StatCard/StatCard.css', 'utf8')
    expect(css).toMatch(/font:\s*800 30px var\(--font-display\)/)
  })
})
