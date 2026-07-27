import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { sportLabel } from '../../../lib/sports'
import { CourtCard } from './CourtCard'

describe('CourtCard', () => {
  it('imports the real SportTag component — no parallel implementation', () => {
    const source = readFileSync('src/components/ui/CourtCard/CourtCard.tsx', 'utf8')
    expect(source).toMatch(/from ['"]\.\.\/SportTag\/SportTag['"]/)
  })

  it('renders a real SportTag for the given sport', () => {
    render(<CourtCard sport="padel" />)
    expect(screen.getByText(sportLabel('padel'))).toBeInTheDocument()
  })

  it('renders name, status and price when given', () => {
    render(<CourtCard sport="padel" name="Quadra Central" status="Disponível" price="R$ 80/h" />)
    expect(screen.getByText('Quadra Central')).toBeInTheDocument()
    expect(screen.getByText('Disponível')).toBeInTheDocument()
    expect(screen.getByText('R$ 80/h')).toBeInTheDocument()
  })

  it('renders as a <div> when onClick is absent', () => {
    const { container } = render(<CourtCard sport="padel" name="Quadra Central" />)
    expect(container.querySelector('div.court-card')).toBeInTheDocument()
    expect(container.querySelector('button')).not.toBeInTheDocument()
  })

  it('renders as a native <button type="button"> when onClick is given, keyboard-activatable', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<CourtCard sport="padel" name="Quadra Central" onClick={onClick} />)
    const button = screen.getByRole('button', { name: /Quadra Central/ })
    expect(button).toHaveAttribute('type', 'button')
    button.focus()
    await user.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders without throwing for an unknown sport slug', () => {
    expect(() => render(<CourtCard sport="krav-maga" name="Quadra X" />)).not.toThrow()
  })
})
