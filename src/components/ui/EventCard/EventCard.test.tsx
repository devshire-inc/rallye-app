import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EventCard } from './EventCard'

describe('EventCard', () => {
  it('imports the real SportTag/EventStatusBadge components — no parallel implementation', () => {
    const source = readFileSync('src/components/ui/EventCard/EventCard.tsx', 'utf8')
    expect(source).toMatch(/from ['"]\.\.\/SportTag\/SportTag['"]/)
    expect(source).toMatch(/from ['"]\.\.\/EventStatusBadge\/EventStatusBadge['"]/)
  })

  it.each([
    ['torneio', 'TORNEIO'],
    ['experimental', 'AULA EXPERIMENTAL'],
    ['social', 'EVENTO SOCIAL'],
    ['bloqueio', 'MANUTENÇÃO'],
  ] as const)('renders the %s eyebrow label', (type, eyebrow) => {
    render(<EventCard type={type} title="Evento" date="Sáb · 09h00" />)
    expect(screen.getByText(eyebrow)).toBeInTheDocument()
  })

  it.each(['torneio', 'experimental', 'social'] as const)(
    'renders sport and status for type=%s when given',
    (type) => {
      render(
        <EventCard
          type={type}
          title="Evento"
          date="Sáb · 09h00"
          location="Arena Beira-Mar"
          sport="beach_tennis"
          status="abertas"
        />,
      )
      expect(screen.getByText('Beach tennis')).toBeInTheDocument()
      expect(screen.getByText('INSCRIÇÕES ABERTAS')).toBeInTheDocument()
      expect(screen.getByText('Arena Beira-Mar')).toBeInTheDocument()
    },
  )

  it('omits sport and status for type=bloqueio even when given', () => {
    render(
      <EventCard
        type="bloqueio"
        title="Manutenção — Quadra 3"
        date="Sáb · 09h00"
        sport="beach_tennis"
        status="abertas"
      />,
    )
    expect(screen.queryByText('Beach tennis')).not.toBeInTheDocument()
    expect(screen.queryByText('INSCRIÇÕES ABERTAS')).not.toBeInTheDocument()
  })

  it('renders type=bloqueio as a non-interactive <article>, ignoring onClick', () => {
    const onClick = vi.fn()
    const { container } = render(
      <EventCard type="bloqueio" title="Manutenção — Quadra 3" date="Sáb · 09h00" onClick={onClick} />,
    )
    expect(container.querySelector('article.event-card')).toBeInTheDocument()
    expect(container.querySelector('button')).not.toBeInTheDocument()
  })

  it('renders as a <div> when onClick is absent (non-bloqueio types)', () => {
    const { container } = render(<EventCard type="social" title="Luau" date="Sáb · 09h00" />)
    expect(container.querySelector('div.event-card')).toBeInTheDocument()
    expect(container.querySelector('button')).not.toBeInTheDocument()
  })

  it('renders as a native <button type="button"> when onClick is given, keyboard-activatable', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <EventCard
        type="torneio"
        title="Torneio de duplas"
        date="Sáb · 09h00"
        location="Arena Beira-Mar"
        sport="beach_tennis"
        status="convite"
        onClick={onClick}
      />,
    )
    const button = screen.getByRole('button', {
      name: 'Torneio de duplas, Sáb · 09h00, Arena Beira-Mar, você foi convidado',
    })
    expect(button).toHaveAttribute('type', 'button')
    button.focus()
    await user.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('builds the accessible name from title, date, location and status label', () => {
    render(
      <EventCard
        type="experimental"
        title="Aula experimental de padel"
        date="Sáb · 09h00"
        location="Arena Beira-Mar"
        sport="padel"
        status="lotado"
        onClick={() => {}}
      />,
    )
    expect(
      screen.getByRole('button', {
        name: 'Aula experimental de padel, Sáb · 09h00, Arena Beira-Mar, lotado',
      }),
    ).toBeInTheDocument()
  })

  it('renders without throwing for an unknown sport slug', () => {
    expect(() =>
      render(<EventCard type="social" title="Evento" date="Sáb · 09h00" sport="krav-maga" />),
    ).not.toThrow()
  })
})
