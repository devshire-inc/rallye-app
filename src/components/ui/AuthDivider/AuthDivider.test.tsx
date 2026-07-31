import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AuthDivider } from './AuthDivider'

describe('AuthDivider', () => {
  it('renders as a separator with the label as its accessible name', () => {
    render(<AuthDivider />)
    expect(screen.getByRole('separator', { name: 'ou' })).toBeInTheDocument()
  })

  it('accepts a custom label', () => {
    render(<AuthDivider label="ou preencha" />)
    expect(screen.getByRole('separator', { name: 'ou preencha' })).toBeInTheDocument()
  })

  it('does not repeat the label for screen readers — visible text is aria-hidden, name comes from the separator', () => {
    render(<AuthDivider />)
    const visibleLabel = screen.getByText('ou')
    expect(visibleLabel).toHaveAttribute('aria-hidden', 'true')
  })

  it('CSS: hairlines flank the label, gap/spacing per spec, no hex literals', () => {
    const css = readFileSync('src/components/ui/AuthDivider/AuthDivider.css', 'utf8')
    expect(css).toMatch(/height:\s*1px/)
    expect(css).toMatch(/background:\s*var\(--border-default\)/)
    expect(css).toMatch(/gap:\s*var\(--space-3\)/)
    expect(css).toMatch(/color:\s*var\(--text-muted\)/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
