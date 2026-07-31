import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SlotChip } from './SlotChip'

describe('SlotChip', () => {
  it('renders a native <button> with the given time', () => {
    render(<SlotChip time="19:00" />)
    expect(screen.getByRole('button', { name: '19:00' })).toHaveAttribute('type', 'button')
  })

  it('is disabled when state="busy"', () => {
    render(<SlotChip time="19:00" state="busy" />)
    expect(screen.getByRole('button', { name: '19:00' })).toBeDisabled()
  })

  it('has aria-pressed="true" when state="selected"', () => {
    render(<SlotChip time="19:00" state="selected" />)
    expect(screen.getByRole('button', { name: '19:00' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('has aria-pressed="false" when state="available" (default)', () => {
    render(<SlotChip time="19:00" />)
    expect(screen.getByRole('button', { name: '19:00' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onClick when clicked while available', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<SlotChip time="19:00" onClick={onClick} />)
    await user.click(screen.getByRole('button', { name: '19:00' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when busy', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<SlotChip time="19:00" state="busy" onClick={onClick} />)
    await user.click(screen.getByRole('button', { name: '19:00' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('CSS: selected state uses --text-on-brand, no hex literals', () => {
    const css = readFileSync('src/components/ui/SlotChip/SlotChip.css', 'utf8')
    expect(css).toMatch(/color:\s*var\(--text-on-brand\)/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('CSS: busy state uses --surface-sunken background, transparent border and --text-muted', () => {
    const css = readFileSync('src/components/ui/SlotChip/SlotChip.css', 'utf8')
    const busyBlock = /\.slot-chip--busy\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(busyBlock).toMatch(/background:\s*var\(--surface-sunken\)/)
    expect(busyBlock).toMatch(/border-color:\s*transparent/)
    expect(busyBlock).toMatch(/color:\s*var\(--text-muted\)/)
  })

  it('CSS: base state uses --radius-md and --type-numeric per Figma (node 42:14)', () => {
    const css = readFileSync('src/components/ui/SlotChip/SlotChip.css', 'utf8')
    const baseBlock = /\.slot-chip\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(baseBlock).toMatch(/border-radius:\s*var\(--radius-md\)/)
    expect(baseBlock).toMatch(/font:\s*var\(--type-numeric\)/)
  })

  it('CSS: focus-visible uses the shared --focus-ring token', () => {
    const css = readFileSync('src/components/ui/SlotChip/SlotChip.css', 'utf8')
    expect(css).toMatch(/:focus-visible\s*\{[^}]*box-shadow:\s*var\(--focus-ring\)/)
  })
})
