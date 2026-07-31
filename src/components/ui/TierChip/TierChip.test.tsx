import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TierChip, type TierChipTier } from './TierChip'

describe('TierChip', () => {
  it('renders with role="img" and an aria-label announcing the full word, not the abbreviation', () => {
    render(<TierChip tier="B" />)
    expect(screen.getByRole('img', { name: 'Nível B' })).toBeInTheDocument()
  })

  it('always shows the visible label text too — color/dot is never the only signal', () => {
    render(<TierChip tier="B" />)
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('renders the full "Pé na Areia" and "Pro/Open" labels', () => {
    render(<TierChip tier="pe-na-areia" />)
    expect(screen.getByRole('img', { name: 'Nível Pé na Areia' })).toBeInTheDocument()

    render(<TierChip tier="pro-open" />)
    expect(screen.getByRole('img', { name: 'Nível Pro/Open' })).toBeInTheDocument()
  })

  it.each(['pe-na-areia', 'D', 'C', 'B', 'A', 'pro-open'] as TierChipTier[])(
    'renders without error for tier=%s',
    (tier) => {
      render(<TierChip tier={tier} />)
    },
  )

  it('marks the dot and visible label text as aria-hidden (the aria-label on the wrapper carries the a11y name)', () => {
    render(<TierChip tier="B" />)
    const chip = screen.getByRole('img', { name: 'Nível B' })
    expect(chip.querySelector('.tier-chip__dot')).toHaveAttribute('aria-hidden', 'true')
    expect(chip.querySelector('.tier-chip__label')).toHaveAttribute('aria-hidden', 'true')
  })

  it('is not focusable/interactive — no tabIndex, no button role', () => {
    render(<TierChip tier="B" />)
    const chip = screen.getByRole('img', { name: 'Nível B' })
    expect(chip.tagName).toBe('SPAN')
    expect(chip).not.toHaveAttribute('tabindex')
  })

  it('defaults --tier-chip-dot-color to --interactive-primary when sportCssVar is not provided', () => {
    render(<TierChip tier="B" />)
    const chip = screen.getByRole('img', { name: 'Nível B' })
    expect(chip.style.getPropertyValue('--tier-chip-dot-color')).toBe('var(--interactive-primary)')
  })

  it('overrides --tier-chip-dot-color via sportCssVar, wrapped in var()', () => {
    render(<TierChip tier="B" sportCssVar="--sport-padel" />)
    const chip = screen.getByRole('img', { name: 'Nível B' })
    expect(chip.style.getPropertyValue('--tier-chip-dot-color')).toBe('var(--sport-padel)')
  })

  it('CSS: fixed surface/brand-soft background and text/brand-strong text, no hex literals', () => {
    const css = readFileSync('src/components/ui/TierChip/TierChip.css', 'utf8')
    const baseBlock = /\.tier-chip\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(baseBlock).toMatch(/background:\s*var\(--surface-brand-soft\)/)
    expect(baseBlock).toMatch(/color:\s*var\(--text-brand-strong\)/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('CSS: dot reads from the overridable --tier-chip-dot-color custom property', () => {
    const css = readFileSync('src/components/ui/TierChip/TierChip.css', 'utf8')
    const dotBlock = /\.tier-chip__dot\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(dotBlock).toMatch(/background:\s*var\(--tier-chip-dot-color,\s*var\(--interactive-primary\)\)/)
  })
})
