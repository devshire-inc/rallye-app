import { screen, within } from '@testing-library/react'
import { renderWithQuery } from '../../test/renderWithQuery'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as usePermissionModule from '../../hooks/usePermission'
import * as tournamentBracketsApi from '../../lib/api/tournamentBrackets'
import type { MatchDetailResponse } from '../../lib/api/tournamentBrackets'

const onMatchChangedCallbacks: ((matchId: string) => void)[] = []

vi.mock('../../hooks/useTournamentLive', () => ({
  useTournamentLive: (_tournamentId: string | undefined, onMatchChanged: (matchId: string) => void) => {
    onMatchChangedCallbacks.push(onMatchChanged)
  },
}))

import MatchDetailPage from './MatchDetailPage'

afterEach(() => {
  vi.restoreAllMocks()
  onMatchChangedCallbacks.length = 0
})

function mockPermissions(map: Record<string, boolean>) {
  vi.spyOn(usePermissionModule, 'usePermission').mockImplementation(
    (module: string, action: string) => map[`${module}:${action}`] ?? false,
  )
}

function matchDetail(overrides: Partial<MatchDetailResponse> = {}): MatchDetailResponse {
  return {
    id: 'match-1',
    categoryId: 'cat-femb',
    phase: 'bracket',
    round: 1,
    bracketType: null,
    groupId: null,
    positionInRound: 1,
    registration1Id: 'reg-1',
    registration2Id: 'reg-2',
    winnerRegistrationId: null,
    nextMatchId: null,
    nextMatchSlot: null,
    loserNextMatchId: null,
    status: 'pending',
    courtId: 'court-2',
    scheduledAt: null,
    createdAt: '2026-07-20T10:00:00Z',
    sets: [
      { setNumber: 1, registration1Score: 7, registration2Score: 5 },
      { setNumber: 2, registration1Score: 5, registration2Score: 5 },
    ],
    registration1Name: 'Julia / Fer',
    registration2Name: 'Camila / Rê',
    ...overrides,
  }
}

function renderPage(matchId = 'match-1', tournamentId = 'tournament-1') {
  mockPermissions({})
  return renderWithQuery(
    <MemoryRouter initialEntries={[`/tournaments/${tournamentId}/matches/${matchId}`]}>
      <Routes>
        <Route path="/tournaments/:tournamentId/matches/:matchId" element={<MatchDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('MatchDetailPage — loading and error', () => {
  it('shows a loading status while the match is being fetched', () => {
    vi.spyOn(tournamentBracketsApi, 'getMatch').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error message when the fetch fails', async () => {
    vi.spyOn(tournamentBracketsApi, 'getMatch').mockResolvedValue({
      ok: false,
      status: 404,
      error: 'match_not_found',
    })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
  })
})

describe('MatchDetailPage — score hero', () => {
  it('shows team names, the live set score, and the SET/AO VIVO/QUADRA badge', async () => {
    vi.spyOn(tournamentBracketsApi, 'getMatch').mockResolvedValue({
      ok: true,
      match: matchDetail(),
    })

    renderPage()

    const hero = await screen.findByTestId('score-hero')
    expect(within(hero).getByText('Julia / Fer')).toBeInTheDocument()
    expect(within(hero).getByText('Camila / Rê')).toBeInTheDocument()
    expect(within(hero.querySelector('.big') as HTMLElement).getAllByText('5')).toHaveLength(2)
    expect(within(hero).getByText(/SET 2 · AO VIVO · QUADRA #COUR/i)).toBeInTheDocument()
  })

  it('shows the FINAL badge once the match is completed', async () => {
    vi.spyOn(tournamentBracketsApi, 'getMatch').mockResolvedValue({
      ok: true,
      match: matchDetail({ status: 'completed', winnerRegistrationId: 'reg-1' }),
    })

    renderPage()

    expect(await screen.findByText('FINAL')).toBeInTheDocument()
  })
})

describe('MatchDetailPage — sets table', () => {
  it('renders one row per team with a score per set and highlights the set winner', async () => {
    vi.spyOn(tournamentBracketsApi, 'getMatch').mockResolvedValue({
      ok: true,
      match: matchDetail(),
    })

    renderPage()

    const table = await screen.findByRole('table')
    const rows = within(table).getAllByRole('row')
    // header + team1 + team2
    expect(rows).toHaveLength(3)
    const team1Row = within(table).getByText('Julia / Fer').closest('tr') as HTMLElement
    expect(within(team1Row).getByText('7')).toHaveClass('w')
  })
})

describe('MatchDetailPage — register result (admin)', () => {
  it('hides the register-result button when the caller lacks torneios:write', async () => {
    vi.spyOn(tournamentBracketsApi, 'getMatch').mockResolvedValue({
      ok: true,
      match: matchDetail(),
    })
    mockPermissions({})

    renderWithQuery(
      <MemoryRouter initialEntries={['/tournaments/tournament-1/matches/match-1']}>
        <Routes>
          <Route path="/tournaments/:tournamentId/matches/:matchId" element={<MatchDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByTestId('score-hero')

    expect(screen.queryByRole('button', { name: /registrar resultado/i })).not.toBeInTheDocument()
  })

  it('opens the TO7 sheet and refreshes the match after a successful submission', async () => {
    const getMatchSpy = vi
      .spyOn(tournamentBracketsApi, 'getMatch')
      .mockResolvedValueOnce({ ok: true, match: matchDetail() })
      .mockResolvedValueOnce({
        ok: true,
        match: matchDetail({ status: 'completed', winnerRegistrationId: 'reg-1' }),
      })
    // registerMatchResult only ever returns a bare MatchResponse (no sets/
    // names — see the code comment in MatchDetailPage.tsx), so the page
    // refetches via getMatch (mocked above) instead of trusting this shape.
    const registerSpy = vi.spyOn(tournamentBracketsApi, 'registerMatchResult').mockResolvedValue({
      ok: true,
      match: {
        id: 'match-1',
        categoryId: 'cat-femb',
        phase: 'bracket',
        round: 1,
        bracketType: null,
        groupId: null,
        positionInRound: 1,
        registration1Id: 'reg-1',
        registration2Id: 'reg-2',
        winnerRegistrationId: 'reg-1',
        nextMatchId: null,
        nextMatchSlot: null,
        loserNextMatchId: null,
        status: 'completed',
        courtId: 'court-2',
        scheduledAt: null,
        createdAt: '2026-07-20T10:00:00Z',
      },
    })
    mockPermissions({ 'torneios:write': true })
    const user = userEvent.setup()

    renderWithQuery(
      <MemoryRouter initialEntries={['/tournaments/tournament-1/matches/match-1']}>
        <Routes>
          <Route path="/tournaments/:tournamentId/matches/:matchId" element={<MatchDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await screen.findByTestId('score-hero')

    await user.click(screen.getByRole('button', { name: /registrar resultado \(admin\)/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.type(screen.getAllByRole('spinbutton', { name: /set 1/i })[0], '21')
    await user.type(screen.getAllByRole('spinbutton', { name: /set 1/i })[1], '15')
    await user.type(screen.getAllByRole('spinbutton', { name: /set 2/i })[0], '21')
    await user.type(screen.getAllByRole('spinbutton', { name: /set 2/i })[1], '15')
    await user.click(screen.getByRole('button', { name: 'Confirmar resultado' }))

    expect(registerSpy).toHaveBeenCalledWith('match-1', {
      sets: [
        { registration1Score: 21, registration2Score: 15 },
        { registration1Score: 21, registration2Score: 15 },
      ],
    })
    expect(await screen.findByText('FINAL')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(getMatchSpy).toHaveBeenCalledTimes(2)
  })
})

describe('MatchDetailPage — realtime updates', () => {
  it('refetches when the live event is for this match', async () => {
    const getMatchSpy = vi.spyOn(tournamentBracketsApi, 'getMatch').mockResolvedValue({
      ok: true,
      match: matchDetail(),
    })

    renderPage()
    await screen.findByTestId('score-hero')
    expect(getMatchSpy).toHaveBeenCalledTimes(1)

    onMatchChangedCallbacks[onMatchChangedCallbacks.length - 1]('match-1')

    await screen.findByTestId('score-hero')
    expect(getMatchSpy).toHaveBeenCalledTimes(2)
  })

  it('ignores a live event for a different match', async () => {
    const getMatchSpy = vi.spyOn(tournamentBracketsApi, 'getMatch').mockResolvedValue({
      ok: true,
      match: matchDetail(),
    })

    renderPage()
    await screen.findByTestId('score-hero')
    expect(getMatchSpy).toHaveBeenCalledTimes(1)

    onMatchChangedCallbacks[onMatchChangedCallbacks.length - 1]('some-other-match')

    expect(getMatchSpy).toHaveBeenCalledTimes(1)
  })
})
