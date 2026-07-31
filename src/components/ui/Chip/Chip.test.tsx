import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Chip } from './Chip'

describe('Chip', () => {
  it('renders a native <button> with the given label', () => {
    render(<Chip label="Beach Tennis" />)
    expect(screen.getByRole('button', { name: 'Beach Tennis' })).toHaveAttribute('type', 'button')
  })

  it('renders custom children instead of label when provided', () => {
    render(<Chip label="fallback">Segunda-feira</Chip>)
    expect(screen.getByText('Segunda-feira')).toBeInTheDocument()
  })

  it('has aria-pressed="false" when unselected (default)', () => {
    render(<Chip label="Padel" />)
    expect(screen.getByRole('button', { name: 'Padel' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('has aria-pressed="true" and the selected modifier class when selected', () => {
    render(<Chip label="Padel" selected />)
    const chip = screen.getByRole('button', { name: 'Padel' })
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    expect(chip.className).toContain('chip--selected')
  })

  it('does not render a dot by default', () => {
    render(<Chip label="Padel" />)
    expect(screen.getByRole('button', { name: 'Padel' }).querySelector('.chip__dot')).toBeNull()
  })

  it('renders an aria-hidden dot when dot is true', () => {
    render(<Chip label="Padel" dot />)
    const dot = screen.getByRole('button', { name: 'Padel' }).querySelector('.chip__dot')
    expect(dot).not.toBeNull()
    expect(dot).toHaveAttribute('aria-hidden', 'true')
  })

  it('sets --chip-dot-color from dotColor when provided', () => {
    render(<Chip label="Padel" dot dotColor="var(--sport-padel)" />)
    const chip = screen.getByRole('button', { name: 'Padel' })
    expect(chip.style.getPropertyValue('--chip-dot-color')).toBe('var(--sport-padel)')
  })

  it('defaults --chip-dot-color to --interactive-primary when dotColor is not provided', () => {
    render(<Chip label="Padel" dot />)
    const chip = screen.getByRole('button', { name: 'Padel' })
    expect(chip.style.getPropertyValue('--chip-dot-color')).toBe('var(--interactive-primary)')
  })

  it('calls onToggle with the flipped selected state when clicked', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(<Chip label="Padel" onToggle={onToggle} />)
    await user.click(screen.getByRole('button', { name: 'Padel' }))
    expect(onToggle).toHaveBeenCalledExactlyOnceWith(true)
  })

  it('calls onToggle with false when clicking an already-selected chip', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(<Chip label="Padel" selected onToggle={onToggle} />)
    await user.click(screen.getByRole('button', { name: 'Padel' }))
    expect(onToggle).toHaveBeenCalledExactlyOnceWith(false)
  })

  it('CSS: selected state uses --interactive-primary background and --text-on-brand text, no hex literals', () => {
    const css = readFileSync('src/components/ui/Chip/Chip.css', 'utf8')
    const selectedBlock = /\.chip--selected\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(selectedBlock).toMatch(/background:\s*var\(--interactive-primary\)/)
    expect(selectedBlock).toMatch(/color:\s*var\(--text-on-brand\)/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('CSS: base state uses --radius-pill and --surface-sunken per Figma (node 98:16)', () => {
    const css = readFileSync('src/components/ui/Chip/Chip.css', 'utf8')
    const baseBlock = /\.chip\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(baseBlock).toMatch(/border-radius:\s*var\(--radius-pill\)/)
    expect(baseBlock).toMatch(/background:\s*var\(--surface-sunken\)/)
  })

  it('CSS: dot is a 10px circle that switches to --text-on-brand when selected', () => {
    const css = readFileSync('src/components/ui/Chip/Chip.css', 'utf8')
    const dotBlock = /\.chip__dot\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(dotBlock).toMatch(/width:\s*10px/)
    expect(dotBlock).toMatch(/height:\s*10px/)
    const selectedDotBlock = /\.chip--selected \.chip__dot\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(selectedDotBlock).toMatch(/background:\s*var\(--text-on-brand\)/)
  })

  it('CSS: focus-visible uses the shared --focus-ring token', () => {
    const css = readFileSync('src/components/ui/Chip/Chip.css', 'utf8')
    expect(css).toMatch(/:focus-visible\s*\{[^}]*box-shadow:\s*var\(--focus-ring\)/)
  })
})
