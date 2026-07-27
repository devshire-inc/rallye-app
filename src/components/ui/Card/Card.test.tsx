import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Card } from './Card'

describe('Card', () => {
  it('renders a <div> when not interactive', () => {
    const { container } = render(<Card>Conteúdo</Card>)
    expect(container.querySelector('div.card')).toBeInTheDocument()
    expect(container.querySelector('button')).not.toBeInTheDocument()
  })

  it('renders a native <button type="button"> when interactive', () => {
    const onClick = vi.fn()
    render(
      <Card interactive onClick={onClick}>
        Conteúdo interativo
      </Card>,
    )
    const button = screen.getByRole('button', { name: 'Conteúdo interativo' })
    expect(button).toHaveAttribute('type', 'button')
  })

  it('fires onClick on click and is activatable via Tab+Enter/Space', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <Card interactive onClick={onClick}>
        Reservar
      </Card>,
    )
    const button = screen.getByRole('button', { name: 'Reservar' })

    await user.tab()
    expect(button).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(1)
    await user.keyboard(' ')
    expect(onClick).toHaveBeenCalledTimes(2)

    await user.click(button)
    expect(onClick).toHaveBeenCalledTimes(3)
  })

  it('defaults padding to 20 and forwards numeric padding as px', () => {
    const { container } = render(<Card>Conteúdo</Card>)
    const card = container.querySelector('.card') as HTMLElement
    expect(card.style.getPropertyValue('--card-padding')).toBe('20px')
  })

  it('accepts a string padding verbatim', () => {
    const { container } = render(<Card padding="var(--space-4)">Conteúdo</Card>)
    const card = container.querySelector('.card') as HTMLElement
    expect(card.style.getPropertyValue('--card-padding')).toBe('var(--space-4)')
  })

  it('CSS: radius, shadow, interactive hover state, no hex literals', () => {
    const css = readFileSync('src/components/ui/Card/Card.css', 'utf8')
    expect(css).toMatch(/border-radius:\s*var\(--radius-lg\)/)
    expect(css).toMatch(/box-shadow:\s*var\(--shadow-card\)/)
    expect(css).toMatch(/box-shadow:\s*var\(--shadow-raised\)/)
    expect(css).toMatch(/translateY\(-2px\)/)
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
