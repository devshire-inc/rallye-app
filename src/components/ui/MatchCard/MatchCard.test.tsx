import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
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

  // Falha pré-existente corrigida: `6` e `4` aparecem nos DOIS lados do
  // confronto (6-4, 4-6, 10-8), então a busca tem de ser plural.
  it('renders up to 3 set-score cells for finished matches', () => {
    const { container } = render(<MatchCard state="finished" format="dupla" participants={dupla} />)
    expect(container.querySelectorAll('.match-card__score')).toHaveLength(6)
    expect(screen.getAllByText('6')).toHaveLength(2)
    expect(screen.getAllByText('4')).toHaveLength(2)
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('caps the set cells at 3 per participant', () => {
    const fourSets: [MatchCardParticipant, MatchCardParticipant] = [
      { name: 'A', sets: [1, 2, 3, 4] },
      { name: 'B', sets: [5, 6, 7, 8] },
    ]
    const { container } = render(<MatchCard state="finished" format="individual" participants={fourSets} />)
    expect(container.querySelectorAll('.match-card__score')).toHaveLength(6)
    expect(screen.queryByText('4')).not.toBeInTheDocument()
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

// Variantes de composição adicionadas para o consumo real na tela de Chave —
// todas aditivas: sem nenhuma delas, o card continua sendo o símbolo do Figma.
describe('MatchCard — modo interativo', () => {
  it('renders a <button> carrying the assembled sentence as its own accessible name', async () => {
    const onClick = vi.fn()
    const participants: [MatchCardParticipant, MatchCardParticipant] = [
      { ...dupla[0], winner: true },
      dupla[1],
    ]
    const user = userEvent.setup()

    render(<MatchCard state="finished" format="dupla" participants={participants} onClick={onClick} />)

    // O ponto: a frase é o nome acessível do PRÓPRIO botão. Um role="group"
    // aninhado num <button> externo a perderia.
    const button = screen.getByRole('button', { name: 'Bruno e Marina venceram por 6-4, 4-6, 10-8' })
    expect(button).toHaveAttribute('type', 'button')
    expect(screen.queryByRole('group')).not.toBeInTheDocument()

    await user.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('keeps aria-live="polite" on the interactive card when live', () => {
    render(<MatchCard state="live" format="dupla" participants={dupla} onClick={() => {}} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-live', 'polite')
  })

  it('stays a non-interactive role="group" when no onClick is given', () => {
    render(<MatchCard state="finished" format="dupla" participants={dupla} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByRole('group')).toBeInTheDocument()
  })

  it('forwards data-testid and className', () => {
    render(
      <MatchCard
        state="finished"
        format="dupla"
        participants={dupla}
        className="x-custom"
        data-testid="card-1"
      />,
    )
    expect(screen.getByTestId('card-1')).toHaveClass('x-custom')
  })
})

describe('MatchCard — variantes de composição', () => {
  it('applies the modifier classes for fluid/compact/footer/emphasis and the state', () => {
    render(
      <MatchCard
        state="live"
        format="dupla"
        participants={dupla}
        fluid
        density="compact"
        statusPlacement="footer"
        winnerStyle="emphasis"
        data-testid="card"
      />,
    )
    const card = screen.getByTestId('card')
    expect(card).toHaveClass('match-card--fluid')
    expect(card).toHaveClass('match-card--compact')
    expect(card).toHaveClass('match-card--status-footer')
    expect(card).toHaveClass('match-card--emphasis')
    expect(card).toHaveClass('match-card--live')
  })

  it('defaults to the Figma symbol: no modifier class when no variant prop is passed', () => {
    render(<MatchCard state="finished" format="dupla" participants={dupla} data-testid="card" />)
    const card = screen.getByTestId('card')
    for (const modifier of [
      'match-card--fluid',
      'match-card--compact',
      'match-card--status-footer',
      'match-card--emphasis',
      'match-card--interactive',
    ]) {
      expect(card).not.toHaveClass(modifier)
    }
  })

  it('moves the status out of the header when statusPlacement="footer"', () => {
    const { container } = render(
      <MatchCard state="live" format="dupla" participants={dupla} statusPlacement="footer" />,
    )
    expect(container.querySelector('.match-card__header .match-card__status')).not.toBeInTheDocument()
    const status = container.querySelector('.match-card__status')
    expect(status).toHaveTextContent('AO VIVO')
    // Última coisa do card, abaixo dos dois participantes.
    expect(status?.previousElementSibling).toHaveClass('match-card__participant')
  })

  it('lets statusLabel override the label derived from state, without touching the aria-label', () => {
    render(
      <MatchCard
        state="live"
        format="dupla"
        participants={dupla}
        statusPlacement="footer"
        statusLabel="Ao vivo · Quadra #7"
      />,
    )
    expect(screen.getByText('Ao vivo · Quadra #7')).toBeInTheDocument()
    expect(screen.queryByText('AO VIVO')).not.toBeInTheDocument()
    expect(
      screen.getByRole('group', { name: 'Bruno e Marina contra Carla e João, ao vivo, 6-4, 4-6, 10-8' }),
    ).toBeInTheDocument()
  })

  it('omits the header entirely when it would be empty', () => {
    const { container } = render(
      <MatchCard state="live" format="dupla" participants={dupla} statusPlacement="footer" />,
    )
    expect(container.querySelector('.match-card__header')).not.toBeInTheDocument()
  })

  it('drops the vs divider when divider={false}', () => {
    const { container, rerender } = render(<MatchCard state="live" format="dupla" participants={dupla} />)
    expect(container.querySelector('.match-card__divider')).toBeInTheDocument()

    rerender(<MatchCard state="live" format="dupla" participants={dupla} divider={false} />)
    expect(container.querySelector('.match-card__divider')).not.toBeInTheDocument()
  })

  it('winnerStyle="emphasis" marks the row instead of drawing the bar and the check', () => {
    const participants: [MatchCardParticipant, MatchCardParticipant] = [
      { ...dupla[0], winner: true },
      dupla[1],
    ]
    const { container } = render(
      <MatchCard state="finished" format="dupla" participants={participants} winnerStyle="emphasis" />,
    )
    expect(container.querySelector('.match-card__winner-bar')).not.toBeInTheDocument()
    expect(screen.queryByText('✓')).not.toBeInTheDocument()
    expect(container.querySelector('.match-card__participant--win')).toHaveTextContent('Bruno & Marina')
  })

  // Em `emphasis` o realce acompanha o dado (é o lado à frente), não o fim do
  // jogo — diferente da barra + check de `marks`.
  it('winnerStyle="emphasis" also marks a live match, which "marks" never does', () => {
    const participants: [MatchCardParticipant, MatchCardParticipant] = [
      { ...dupla[0], winner: true },
      dupla[1],
    ]
    const { container, rerender } = render(
      <MatchCard state="live" format="dupla" participants={participants} winnerStyle="emphasis" />,
    )
    expect(container.querySelector('.match-card__participant--win')).toBeInTheDocument()

    rerender(<MatchCard state="live" format="dupla" participants={participants} />)
    expect(container.querySelector('.match-card__participant--win')).not.toBeInTheDocument()
  })

  it('treats a dupla as plural in the aria-label even when the backend sends one joined string', () => {
    const joined: [MatchCardParticipant, MatchCardParticipant] = [
      { name: 'Marina / Carla', sets: [6], winner: true },
      { name: 'Duda / Bia', sets: [4] },
    ]
    render(<MatchCard state="finished" format="dupla" participants={joined} />)
    expect(screen.getByRole('group', { name: 'Marina / Carla venceram por 6-4' })).toBeInTheDocument()
  })

  it('keeps non-numeric score cells visible but out of the aria-label summary', () => {
    const noScores: [MatchCardParticipant, MatchCardParticipant] = [
      { name: 'Marina / Carla', sets: ['—'] },
      { name: 'A definir', sets: ['—'] },
    ]
    render(<MatchCard state="live" format="dupla" participants={noScores} />)
    expect(screen.getAllByText('—')).toHaveLength(2)
    expect(
      screen.getByRole('group', { name: 'Marina / Carla contra A definir, ao vivo' }),
    ).toBeInTheDocument()
  })
})

describe('MatchCard — CSS das variantes', () => {
  const css = readFileSync('src/components/ui/MatchCard/MatchCard.css', 'utf8')

  /** Cada regra de variante depende de uma classe de modificador — nenhuma
   * pode alcançar o símbolo do Figma, que não recebe modificador nenhum. */
  it('keeps every variant rule behind its own modifier class', () => {
    const variantSelectors = [
      /\.match-card--fluid\s*\{[^}]*width:\s*100%/,
      /\.match-card--compact\s*\{[^}]*gap:\s*var\(--space-1\)/,
      /\.match-card--compact\.match-card--live\s*\{[^}]*border-color:\s*var\(--state-danger\)/,
      /\.match-card--compact\.match-card--scheduled\s*\{[^}]*border-color:\s*var\(--border-strong\)/,
      /\.match-card--status-footer \.match-card__status\s*\{/,
      /\.match-card--emphasis \.match-card__participant--win \.match-card__name\s*\{[^}]*color:\s*var\(--text-brand-strong\)/,
      /\.match-card--interactive\s*\{[^}]*cursor:\s*pointer/,
    ]
    for (const selector of variantSelectors) expect(css).toMatch(selector)
  })

  /** O hover tem de vir DEPOIS dos contornos de estado — é o que faz o card
   * clicável responder ao ponteiro mesmo no estado ao vivo. */
  it('declares the interactive hover after the compact state outlines', () => {
    expect(css.indexOf('.match-card--interactive:hover')).toBeGreaterThan(
      css.indexOf('.match-card--compact.match-card--scheduled'),
    )
  })

  /** Os três pontos de ajuste por breakpoint são lidos com fallback: quem
   * compõe a chave redefine as custom properties num ancestral, e o
   * componente sozinho continua fechado. */
  it.each([
    ['--match-card-compact-padding', 'var(--space-2) var(--space-3)'],
    ['--match-card-compact-radius', 'var(--radius-sm)'],
    ['--match-card-text-size', '13px'],
  ])('reads %s with a built-in fallback', (property, fallback) => {
    expect(css).toContain(`var(${property}, ${fallback})`)
  })

  it('no hex color literals (tokens only)', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
