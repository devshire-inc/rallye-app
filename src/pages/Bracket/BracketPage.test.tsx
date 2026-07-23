import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as tournamentBracketsApi from '../../lib/api/tournamentBrackets'
import type {
  BracketCategory,
  MatchDetailResponse,
  TournamentBracketInfo,
} from '../../lib/api/tournamentBrackets'

const onMatchChangedCallbacks: ((matchId: string) => void)[] = []

vi.mock('../../hooks/useTournamentLive', () => ({
  useTournamentLive: (_tournamentId: string | undefined, onMatchChanged: (matchId: string) => void) => {
    onMatchChangedCallbacks.push(onMatchChanged)
  },
}))

import BracketPage from './BracketPage'

afterEach(() => {
  vi.restoreAllMocks()
  onMatchChangedCallbacks.length = 0
})

function category(overrides: Partial<BracketCategory> = {}): BracketCategory {
  return {
    id: 'cat-femb',
    name: 'Feminina B',
    skillTier: 'b',
    genderScope: 'feminino',
    modality: 'duplas',
    bracketFormat: 'single_elimination',
    ...overrides,
  }
}

function tournamentInfo(overrides: Partial<TournamentBracketInfo> = {}): TournamentBracketInfo {
  return {
    id: 'tournament-1',
    name: 'Copa Areia Dourada',
    status: 'em_andamento',
    categories: [category()],
    ...overrides,
  }
}

function match(overrides: Partial<MatchDetailResponse> = {}): MatchDetailResponse {
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
    courtId: null,
    scheduledAt: null,
    createdAt: '2026-07-20T10:00:00Z',
    sets: [],
    registration1Name: 'Marina / Carla',
    registration2Name: 'Duda / Bia',
    ...overrides,
  }
}

function renderPage(tournamentId = 'tournament-1') {
  return render(
    <MemoryRouter initialEntries={[`/tournaments/${tournamentId}/bracket`]}>
      <Routes>
        <Route path="/tournaments/:tournamentId/bracket" element={<BracketPage />} />
        <Route
          path="/tournaments/:tournamentId/matches/:matchId"
          element={<div>Match detail placeholder</div>}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('BracketPage — loading and error', () => {
  it('shows a loading status while the tournament is being fetched', () => {
    vi.spyOn(tournamentBracketsApi, 'getTournamentBracketInfo').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error message when the tournament fetch fails', async () => {
    vi.spyOn(tournamentBracketsApi, 'getTournamentBracketInfo').mockResolvedValue({
      ok: false,
      status: 404,
      error: 'tournament_not_found',
    })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
  })
})

describe('BracketPage — category tabs', () => {
  it('renders one tab per category and fetches matches for the first one by default', async () => {
    vi.spyOn(tournamentBracketsApi, 'getTournamentBracketInfo').mockResolvedValue({
      ok: true,
      tournament: tournamentInfo({
        categories: [category({ id: 'cat-femb', name: 'Fem B' }), category({ id: 'cat-masc', name: 'Masc B' })],
      }),
    })
    const matchesSpy = vi
      .spyOn(tournamentBracketsApi, 'listCategoryMatches')
      .mockResolvedValue({ ok: true, categoryId: 'cat-femb', matches: [] })

    renderPage()
    await screen.findByRole('tab', { name: 'Fem B' })

    expect(matchesSpy).toHaveBeenCalledWith('cat-femb')
    expect(screen.getByRole('tab', { name: 'Fem B' })).toHaveAttribute('aria-selected', 'true')
  })

  it('refetches matches for the newly selected category', async () => {
    vi.spyOn(tournamentBracketsApi, 'getTournamentBracketInfo').mockResolvedValue({
      ok: true,
      tournament: tournamentInfo({
        categories: [category({ id: 'cat-femb', name: 'Fem B' }), category({ id: 'cat-masc', name: 'Masc B' })],
      }),
    })
    const matchesSpy = vi
      .spyOn(tournamentBracketsApi, 'listCategoryMatches')
      .mockResolvedValue({ ok: true, categoryId: 'cat-femb', matches: [] })
    const user = userEvent.setup()

    renderPage()
    await screen.findByRole('tab', { name: 'Fem B' })

    await user.click(screen.getByRole('tab', { name: 'Masc B' }))

    expect(matchesSpy).toHaveBeenCalledWith('cat-masc')
  })
})

describe('BracketPage — no bracket generated yet', () => {
  it('shows the locked copy when the category has no matches', async () => {
    vi.spyOn(tournamentBracketsApi, 'getTournamentBracketInfo').mockResolvedValue({
      ok: true,
      tournament: tournamentInfo(),
    })
    vi.spyOn(tournamentBracketsApi, 'listCategoryMatches').mockResolvedValue({
      ok: true,
      categoryId: 'cat-femb',
      matches: [],
    })

    renderPage()

    expect(await screen.findByText('Chaves serão divulgadas em breve.')).toBeInTheDocument()
  })
})

describe('BracketPage — single elimination bracket', () => {
  it('groups matches by round with QUARTAS/SEMI/FINAL labels, marks the winner, and shows the stats footer', async () => {
    vi.spyOn(tournamentBracketsApi, 'getTournamentBracketInfo').mockResolvedValue({
      ok: true,
      tournament: tournamentInfo(),
    })
    vi.spyOn(tournamentBracketsApi, 'listCategoryMatches').mockResolvedValue({
      ok: true,
      categoryId: 'cat-femb',
      matches: [
        match({
          id: 'match-qf1',
          round: 1,
          status: 'completed',
          registration1Id: 'reg-1',
          registration2Id: 'reg-2',
          winnerRegistrationId: 'reg-1',
          registration1Name: 'Marina / Carla',
          registration2Name: 'Duda / Bia',
        }),
        match({
          id: 'match-sf1',
          round: 2,
          status: 'pending',
          registration1Id: null,
          registration2Id: null,
          registration1Name: null,
          registration2Name: null,
        }),
        match({
          id: 'match-final',
          round: 3,
          status: 'pending',
          registration1Id: null,
          registration2Id: null,
          registration1Name: null,
          registration2Name: null,
        }),
      ],
    })

    renderPage()

    expect(await screen.findByText('Quartas')).toBeInTheDocument()
    expect(screen.getByText('Semifinal')).toBeInTheDocument()
    expect(screen.getByText('Final')).toBeInTheDocument()

    const winnerCard = screen.getByTestId('match-card-match-qf1')
    const winnerRow = within(winnerCard).getByText('Marina / Carla').closest('.mrow')
    expect(winnerRow).toHaveClass('win')
    expect(within(winnerCard).getByText(/finalizado/i)).toBeInTheDocument()

    expect(screen.getAllByText('A definir')).toHaveLength(4)
    for (const label of screen.getAllByText('A definir')) {
      expect(label.closest('.mrow')).not.toHaveClass('win')
    }

    expect(screen.getByText(/2 duplas · 3 jogos · 1 finalizados/i)).toBeInTheDocument()
  })

  it('navigates to the match detail route when a match card is tapped', async () => {
    vi.spyOn(tournamentBracketsApi, 'getTournamentBracketInfo').mockResolvedValue({
      ok: true,
      tournament: tournamentInfo(),
    })
    vi.spyOn(tournamentBracketsApi, 'listCategoryMatches').mockResolvedValue({
      ok: true,
      categoryId: 'cat-femb',
      matches: [match({ id: 'match-qf1' })],
    })
    const user = userEvent.setup()

    renderPage()

    await user.click(await screen.findByTestId('match-card-match-qf1'))

    expect(await screen.findByText('Match detail placeholder')).toBeInTheDocument()
  })
})

describe('BracketPage — round robin / swiss (table view)', () => {
  it('renders matches grouped by round as a list instead of bracket columns', async () => {
    vi.spyOn(tournamentBracketsApi, 'getTournamentBracketInfo').mockResolvedValue({
      ok: true,
      tournament: tournamentInfo({
        categories: [category({ id: 'cat-femb', bracketFormat: 'round_robin' })],
      }),
    })
    vi.spyOn(tournamentBracketsApi, 'listCategoryMatches').mockResolvedValue({
      ok: true,
      categoryId: 'cat-femb',
      matches: [match({ id: 'match-1', phase: 'group_stage', round: 1 })],
    })

    renderPage()

    expect(await screen.findByTestId('bracket-table-view')).toBeInTheDocument()
    expect(screen.queryByTestId('bracket-columns-view')).not.toBeInTheDocument()
  })
})

describe('BracketPage — realtime updates', () => {
  it('refetches the active category matches when a live match_changed event fires', async () => {
    vi.spyOn(tournamentBracketsApi, 'getTournamentBracketInfo').mockResolvedValue({
      ok: true,
      tournament: tournamentInfo(),
    })
    const matchesSpy = vi
      .spyOn(tournamentBracketsApi, 'listCategoryMatches')
      .mockResolvedValue({ ok: true, categoryId: 'cat-femb', matches: [match({ id: 'match-1' })] })

    renderPage()
    await screen.findByTestId('match-card-match-1')
    expect(matchesSpy).toHaveBeenCalledTimes(1)

    // A mock hook re-registers its callback on every render (it has no
    // internal ref, unlike the real useTournamentLive) — grab the latest
    // one, matching what the real hook's ref-forwarding guarantees.
    onMatchChangedCallbacks[onMatchChangedCallbacks.length - 1]('match-1')

    await waitFor(() => expect(matchesSpy).toHaveBeenCalledTimes(2))
  })
})
