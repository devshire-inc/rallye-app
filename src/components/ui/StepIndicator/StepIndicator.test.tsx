import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StepIndicator } from './StepIndicator'

describe('StepIndicator', () => {
  it('renders the caller-supplied label as visible text and accessible name — never derived from total/current', () => {
    render(<StepIndicator total={3} current={2} label="Passo 2 de 3" />)
    expect(screen.getByRole('group', { name: 'Passo 2 de 3' })).toBeInTheDocument()
    expect(screen.getByText('Passo 2 de 3')).toBeInTheDocument()
  })

  it('renders one segment per total step', () => {
    const { container } = render(<StepIndicator total={3} current={1} label="Passo 1 de 3" />)
    expect(container.querySelectorAll('.step-indicator__segment')).toHaveLength(3)
  })

  it('marks segments up to and including current as done, the rest as todo', () => {
    const { container } = render(<StepIndicator total={3} current={2} label="Passo 2 de 3" />)
    const segments = container.querySelectorAll('.step-indicator__segment')
    expect(segments[0]).toHaveClass('step-indicator__segment--done')
    expect(segments[1]).toHaveClass('step-indicator__segment--done')
    expect(segments[2]).toHaveClass('step-indicator__segment--todo')
  })

  it('supports the Total=2 matrix (no Current=3)', () => {
    const { container } = render(<StepIndicator total={2} current={2} label="Passo 2 de 2" />)
    expect(container.querySelectorAll('.step-indicator__segment')).toHaveLength(2)
  })

  it('CSS: 6px track height, radius/pill segments, done vs todo token mapping, no hex literals', () => {
    const css = readFileSync('src/components/ui/StepIndicator/StepIndicator.css', 'utf8')
    expect(css).toMatch(/height:\s*6px/)
    expect(css).toMatch(/border-radius:\s*var\(--radius-pill\)/)
    expect(css).toMatch(/background:\s*var\(--interactive-primary\)/)
    expect(css).toMatch(/background:\s*var\(--border-default\)/)
    expect(css).toMatch(/color:\s*var\(--text-brand\)/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
