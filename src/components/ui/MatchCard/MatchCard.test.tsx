import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MatchCard, type MatchCardParticipant } from './MatchCard'

const dupla: [MatchCardParticipant, MatchCardParticipant] = [
  { seed: 1, name: ['Bruno', 'Marina'], sets: [6, 4, 10] },
  { seed: 8, name: ['Carla', 'João'], sets: [4, 6, 8] },
]

const individual: [MatchCardParticipant, MatchCardParticipant] = [
  { seed: 1, name: 'Bruno Fernandes', sets: [6, 4, 10] },
  { seed: 8, name: 'Carla Souza', sets: [4, 6, 8] },
]

describe('MatchCard', () => {
  it('renders a joined pair name for format="dupla" and a single name for format="individual"', () => {
    render(<MatchCard state="scheduled" format="dupla" participants={dupla} />)
    expect(screen.getByText('Bruno & Marina')).toBeInTheDocument()

    render(<MatchCard state="scheduled" format="individual" participants={individual} />)
    expect(screen.getByText('Bruno Fernandes')).toBeInTheDocument()
  })

  it.each([
    ['scheduled', undefined],
    ['live', 'AO VIVO'],
    ['finished', 'ENCERRADA'],
    ['wo', 'W.O.'],
  ] as const)('renders the correct status label for state=%s', (state, label) => {
    render(<MatchCard state={state} format="dupla" participants={dupla} scheduledLabel="Sáb, 14:00" />)
    if (label) expect(screen.getByText(label)).toBeInTheDocument()
    else expect(screen.getByText('Sáb, 14:00')).toBeInTheDocument()
  })

  it('only shows the winner check + bar when state is finished or wo, never scheduled/live', () => {
    const withWinner: [MatchCardParticipant, MatchCardParticipant] = [
      { ...dupla[0], winner: true },
      dupla[1],
    ]

    const { rerender, container } = render(<MatchCard state="scheduled" format="dupla" participants={withWinner} />)
    expect(screen.queryByText('✓')).not.toBeInTheDocument()
    expect(container.querySelector('.match-card__winner-bar')).not.toBeInTheDocument()

    rerender(<MatchCard state="live" format="dupla" participants={withWinner} />)
    expect(screen.queryByText('✓')).not.toBeInTheDocument()

    rerender(<MatchCard state="finished" format="dupla" participants={withWinner} />)
    expect(screen.getByText('✓')).toBeInTheDocument()
    expect(container.querySelector('.match-card__winner-bar')).toBeInTheDocument()

    rerender(<MatchCard state="wo" format="dupla" participants={withWinner} />)
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('hides set scores and appends "(W.O.)" to both names when state="wo"', () => {
    render(<MatchCard state="wo" format="dupla" participants={dupla} />)
    expect(screen.getByText('Bruno & Marina (W.O.)')).toBeInTheDocument()
    expect(screen.getByText('Carla & João (W.O.)')).toBeInTheDocument()
    expect(screen.queryByText('6')).not.toBeInTheDocument()
  })

  it('renders up to 3 set-score cells for finished matches', () => {
    render(<MatchCard state="finished" format="dupla" participants={dupla} />)
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('sets aria-live="polite" only when state="live"', () => {
    const { rerender } = render(<MatchCard state="live" format="dupla" participants={dupla} />)
    expect(screen.getByRole('group')).toHaveAttribute('aria-live', 'polite')

    rerender(<MatchCard state="finished" format="dupla" participants={dupla} />)
    expect(screen.getByRole('group')).not.toHaveAttribute('aria-live')
  })

  it('computes a full-sentence aria-label for a finished dupla match with a winner', () => {
    const participants: [MatchCardParticipant, MatchCardParticipant] = [
      { ...dupla[0], winner: true },
      dupla[1],
    ]
    render(<MatchCard state="finished" format="dupla" participants={participants} />)
    expect(screen.getByRole('group', { name: 'Bruno e Marina venceram por 6-4, 4-6, 10-8' })).toBeInTheDocument()
  })

  it('computes a singular verb in the aria-label when the winner is an individual participant', () => {
    const participants: [MatchCardParticipant, MatchCardParticipant] = [
      { ...individual[0], winner: true },
      individual[1],
    ]
    render(<MatchCard state="finished" format="individual" participants={participants} />)
    expect(
      screen.getByRole('group', { name: 'Bruno Fernandes venceu por 6-4, 4-6, 10-8' }),
    ).toBeInTheDocument()
  })

  it('computes a W.O. aria-label naming the winner, without a score summary', () => {
    const participants: [MatchCardParticipant, MatchCardParticipant] = [
      { ...dupla[0], winner: true },
      dupla[1],
    ]
    render(<MatchCard state="wo" format="dupla" participants={participants} />)
    expect(screen.getByRole('group', { name: 'Bruno e Marina venceram por W.O.' })).toBeInTheDocument()
  })

  it('computes a scheduled aria-label mentioning both sides and the schedule text', () => {
    render(<MatchCard state="scheduled" format="dupla" participants={dupla} scheduledLabel="Sáb, 14:00" />)
    expect(
      screen.getByRole('group', { name: 'Bruno e Marina contra Carla e João, agendado para Sáb, 14:00' }),
    ).toBeInTheDocument()
  })

  it('CSS: no hex literals, status tones map to the documented semantic tokens', () => {
    const css = readFileSync('src/components/ui/MatchCard/MatchCard.css', 'utf8')
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).toMatch(/\.match-card__status--live\s*\{[^}]*color:\s*var\(--state-danger-text\)/)
    expect(css).toMatch(/\.match-card__status--finished\s*\{[^}]*color:\s*var\(--state-success-text\)/)
    expect(css).toMatch(/\.match-card__status--wo\s*\{[^}]*color:\s*var\(--state-warning-text\)/)
    expect(css).toMatch(/\.match-card__status--muted\s*\{[^}]*color:\s*var\(--text-muted\)/)
  })
})
