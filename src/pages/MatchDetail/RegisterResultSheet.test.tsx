import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as tournamentBracketsApi from '../../lib/api/tournamentBrackets'
import type { MatchResponse } from '../../lib/api/tournamentBrackets'
import { RegisterResultSheet } from './RegisterResultSheet'

afterEach(() => {
  vi.restoreAllMocks()
})

function matchResponse(overrides: Partial<MatchResponse> = {}): MatchResponse {
  return {
    id: 'match-1',
    categoryId: 'cat-1',
    phase: 'bracket',
    round: 2,
    bracketType: null,
    groupId: null,
    positionInRound: 1,
    registration1Id: 'reg-1',
    registration2Id: 'reg-2',
    winnerRegistrationId: 'reg-1',
    nextMatchId: 'match-5',
    nextMatchSlot: 1,
    loserNextMatchId: null,
    status: 'completed',
    courtId: 'court-2',
    scheduledAt: null,
    createdAt: '2026-07-20T10:00:00Z',
    ...overrides,
  }
}

function renderSheet(overrides: Partial<Parameters<typeof RegisterResultSheet>[0]> = {}) {
  const onSuccess = vi.fn()
  const onCancel = vi.fn()
  render(
    <RegisterResultSheet
      matchId="match-1"
      categoryLabel="Quartas Fem B"
      team1Name="Julia / Fer"
      team2Name="Camila / Rê"
      courtLabel="Quadra 2"
      onSuccess={onSuccess}
      onCancel={onCancel}
      {...overrides}
    />,
  )
  return { onSuccess, onCancel }
}

async function fillSet(user: ReturnType<typeof userEvent.setup>, setIndex: number, s1: string, s2: string) {
  const row1 = screen.getByTestId(`set-row-team1`)
  const row2 = screen.getByTestId(`set-row-team2`)
  await user.type(within(row1).getAllByRole('spinbutton')[setIndex], s1)
  await user.type(within(row2).getAllByRole('spinbutton')[setIndex], s2)
}

describe('RegisterResultSheet — match info', () => {
  it('renders the heading, composed subtitle, and 3 set inputs per team', () => {
    renderSheet()

    expect(screen.getByRole('heading', { name: 'Registrar resultado' })).toBeInTheDocument()
    expect(screen.getByText('Quartas Fem B · Julia / Fer × Camila / Rê · Quadra 2')).toBeInTheDocument()
    expect(within(screen.getByTestId('set-row-team1')).getAllByRole('spinbutton')).toHaveLength(3)
    expect(within(screen.getByTestId('set-row-team2')).getAllByRole('spinbutton')).toHaveLength(3)
  })

  it('renders the exact locked footnote copy', () => {
    renderSheet()

    expect(
      screen.getByText(
        'Vencedor detectado pelo placar (2 de 3 sets). Confirmação avança a chave em tempo real e notifica o próximo jogo. Editável por 24h.',
      ),
    ).toBeInTheDocument()
  })
})

describe('RegisterResultSheet — client-side winner detection', () => {
  it('shows the detected winner once one side has taken 2 of 3 sets', async () => {
    const user = userEvent.setup()
    renderSheet()

    await fillSet(user, 0, '21', '15')
    await fillSet(user, 1, '18', '21')
    expect(screen.queryByTestId('detected-winner')).not.toBeInTheDocument()

    await fillSet(user, 2, '21', '12')

    expect(screen.getByTestId('detected-winner')).toHaveTextContent('Julia / Fer')
  })
})

describe('RegisterResultSheet — WO', () => {
  it('reveals a winner-side picker and disables score inputs when WO is checked', async () => {
    const user = userEvent.setup()
    renderSheet()

    await user.click(screen.getByRole('checkbox', { name: /wo \(walkover\)/i }))

    expect(screen.getByRole('radio', { name: 'Julia / Fer' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Camila / Rê' })).toBeInTheDocument()
    const row1 = screen.getByTestId('set-row-team1')
    for (const input of within(row1).getAllByRole('spinbutton')) {
      expect(input).toBeDisabled()
    }
  })
})

describe('RegisterResultSheet — submitting', () => {
  it('shows an inline error and does not submit when the score is incomplete', async () => {
    const spy = vi.spyOn(tournamentBracketsApi, 'registerMatchResult')
    const user = userEvent.setup()
    renderSheet()

    await user.click(screen.getByRole('button', { name: 'Confirmar resultado' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/placar incompleto/i)
    expect(spy).not.toHaveBeenCalled()
  })

  it('submits the played sets and reports success', async () => {
    const spy = vi
      .spyOn(tournamentBracketsApi, 'registerMatchResult')
      .mockResolvedValue({ ok: true, match: matchResponse() })
    const user = userEvent.setup()
    const { onSuccess } = renderSheet()

    await fillSet(user, 0, '21', '15')
    await fillSet(user, 1, '18', '21')
    await fillSet(user, 2, '21', '12')
    await user.click(screen.getByRole('button', { name: 'Confirmar resultado' }))

    expect(spy).toHaveBeenCalledWith('match-1', {
      sets: [
        { registration1Score: 21, registration2Score: 15 },
        { registration1Score: 18, registration2Score: 21 },
        { registration1Score: 21, registration2Score: 12 },
      ],
    })
    expect(await screen.findByTestId('detected-winner')).toBeInTheDocument()
    expect(onSuccess).toHaveBeenCalledWith(matchResponse())
  })

  it('submits a walkover payload for the selected side', async () => {
    const spy = vi
      .spyOn(tournamentBracketsApi, 'registerMatchResult')
      .mockResolvedValue({ ok: true, match: matchResponse({ status: 'walkover' }) })
    const user = userEvent.setup()
    const { onSuccess } = renderSheet()

    await user.click(screen.getByRole('checkbox', { name: /wo \(walkover\)/i }))
    await user.click(screen.getByRole('radio', { name: 'Camila / Rê' }))
    await user.click(screen.getByRole('button', { name: 'Confirmar resultado' }))

    expect(spy).toHaveBeenCalledWith('match-1', { walkover: 'registration2' })
    expect(onSuccess).toHaveBeenCalled()
  })

  it('shows the backend message and does not call onSuccess when the edit window has expired', async () => {
    vi.spyOn(tournamentBracketsApi, 'registerMatchResult').mockResolvedValue({
      ok: false,
      status: 409,
      error: 'edit_window_expired',
      message: 'o resultado só pode ser corrigido em até 24h depois de registrado',
    })
    const user = userEvent.setup()
    const { onSuccess } = renderSheet()

    await fillSet(user, 0, '21', '15')
    await fillSet(user, 1, '18', '21')
    await fillSet(user, 2, '21', '12')
    await user.click(screen.getByRole('button', { name: 'Confirmar resultado' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/24h depois de registrado/i)
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
