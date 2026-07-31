import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ArenaCard } from './ArenaCard'

describe('ArenaCard', () => {
  it('imports the real ListRow/Badge components — no parallel implementation', () => {
    const source = readFileSync('src/components/ui/ArenaCard/ArenaCard.tsx', 'utf8')
    expect(source).toMatch(/from ['"]\.\.\/ListRow\/ListRow['"]/)
    expect(source).toMatch(/from ['"]\.\.\/Badge\/Badge['"]/)
  })

  it('renders the arena name and subtitle', () => {
    render(<ArenaCard name="Arena Beira-Mar" subtitle="Rua das Palmeiras, 120" />)
    expect(screen.getByText('Arena Beira-Mar')).toBeInTheDocument()
    expect(screen.getByText('Rua das Palmeiras, 120')).toBeInTheDocument()
  })

  it('omits the subtitle when not given', () => {
    const { container } = render(<ArenaCard name="Arena Beira-Mar" />)
    expect(container.querySelector('.list-row__meta')).not.toBeInTheDocument()
  })

  it('renders the role badge joining roles with " · ", uppercased', () => {
    render(<ArenaCard name="Arena Beira-Mar" roles={['Dono', 'Admin']} />)
    expect(screen.getByText('DONO · ADMIN')).toBeInTheDocument()
  })

  it('renders a real Badge (tone=success) for the role badge', () => {
    render(<ArenaCard name="Arena Beira-Mar" roles={['Dono']} />)
    const badge = screen.getByText('DONO')
    expect(badge.className).toContain('badge--success')
  })

  it('omits the meta row entirely when there are no roles and no sports', () => {
    const { container } = render(<ArenaCard name="Arena Beira-Mar" />)
    expect(container.querySelector('.arena-card__meta-row')).not.toBeInTheDocument()
  })

  it('renders one dot per sport', () => {
    const { container } = render(<ArenaCard name="Arena Beira-Mar" sports={['beach_tennis', 'padel', 'volei']} />)
    expect(container.querySelectorAll('.arena-card__dot')).toHaveLength(3)
  })

  it('colors each dot with the matching sport CSS var', () => {
    const { container } = render(<ArenaCard name="Arena Beira-Mar" sports={['padel']} />)
    const dot = container.querySelector('.arena-card__dot')
    expect(dot).toHaveStyle({ '--dot-color': 'var(--sport-padel)' })
  })

  it('renders a chevron via the composed ListRow', () => {
    const { container } = render(<ArenaCard name="Arena Beira-Mar" />)
    expect(container.querySelector('.list-row__chevron')).toBeInTheDocument()
  })

  it('renders as a <div> when onClick is absent', () => {
    const { container } = render(<ArenaCard name="Arena Beira-Mar" />)
    expect(container.querySelector('div.arena-card')).toBeInTheDocument()
    expect(container.querySelector('button.arena-card')).not.toBeInTheDocument()
  })

  it('renders as a native <button type="button"> when onClick is given, keyboard-activatable', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<ArenaCard name="Arena Beira-Mar" onClick={onClick} />)
    const button = screen.getByRole('button', { name: /Arena Beira-Mar/ })
    expect(button).toHaveAttribute('type', 'button')
    button.focus()
    await user.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders without throwing for an unknown sport slug', () => {
    expect(() => render(<ArenaCard name="Arena Beira-Mar" sports={['krav-maga']} />)).not.toThrow()
  })

  it('renders the role badge with a custom tone via roleTone', () => {
    render(<ArenaCard name="Arena Beira-Mar" roles={['Professor']} roleTone="info" />)
    const badge = screen.getByText('PROFESSOR')
    expect(badge.className).toContain('badge--info')
  })

  it('sets data-arena on the root element from testId', () => {
    const { container } = render(<ArenaCard name="Arena Beira-Mar" testId="unit-1" />)
    expect(container.querySelector('div.arena-card')).toHaveAttribute('data-arena', 'unit-1')
  })

  it('sets data-arena on the root button when interactive', () => {
    render(<ArenaCard name="Arena Beira-Mar" onClick={vi.fn()} testId="unit-1" />)
    expect(screen.getByRole('button')).toHaveAttribute('data-arena', 'unit-1')
  })

  it('applies the disabled visual state and blocks clicks when disabled', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<ArenaCard name="Arena Beira-Mar" onClick={onClick} disabled />)
    const button = screen.getByRole('button', { name: /Arena Beira-Mar/ })
    expect(button.className).toContain('arena-card--disabled')
    expect(button).toBeDisabled()
    await user.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('applies the disabled visual class to a non-interactive card too', () => {
    const { container } = render(<ArenaCard name="Arena Beira-Mar" disabled />)
    expect(container.querySelector('div.arena-card')?.className).toContain('arena-card--disabled')
  })
})
