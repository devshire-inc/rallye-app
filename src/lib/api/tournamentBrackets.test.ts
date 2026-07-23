import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import {
  getMatch,
  getTournamentBracketInfo,
  listCategoryMatches,
  registerMatchResult,
} from './tournamentBrackets'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('registerMatchResult', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POSTs sets to /tournament-matches/{id}/result and maps the wire shape to camelCase', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        id: 'match-1',
        category_id: 'cat-1',
        phase: 'bracket',
        round: 2,
        bracket_type: null,
        group_id: null,
        position_in_round: 1,
        registration1_id: 'reg-1',
        registration2_id: 'reg-2',
        winner_registration_id: 'reg-1',
        next_match_id: 'match-5',
        next_match_slot: 1,
        loser_next_match_id: null,
        status: 'completed',
        court_id: 'court-1',
        scheduled_at: null,
        created_at: '2026-07-20T10:00:00Z',
      }),
    )

    const result = await registerMatchResult('match-1', {
      sets: [
        { registration1Score: 21, registration2Score: 15 },
        { registration1Score: 18, registration2Score: 21 },
        { registration1Score: 21, registration2Score: 12 },
      ],
    })

    expect(apiFetchMock).toHaveBeenCalledWith('/tournament-matches/match-1/result', {
      method: 'POST',
      body: JSON.stringify({
        sets: [
          { registration1_score: 21, registration2_score: 15 },
          { registration1_score: 18, registration2_score: 21 },
          { registration1_score: 21, registration2_score: 12 },
        ],
      }),
    })
    expect(result).toEqual({
      ok: true,
      match: {
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
        courtId: 'court-1',
        scheduledAt: null,
        createdAt: '2026-07-20T10:00:00Z',
      },
    })
  })

  it('POSTs a walkover payload', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        id: 'match-1',
        category_id: 'cat-1',
        phase: 'bracket',
        round: 1,
        bracket_type: null,
        group_id: null,
        position_in_round: 1,
        registration1_id: 'reg-1',
        registration2_id: 'reg-2',
        winner_registration_id: 'reg-1',
        next_match_id: null,
        next_match_slot: null,
        loser_next_match_id: null,
        status: 'walkover',
        court_id: null,
        scheduled_at: null,
        created_at: '2026-07-20T10:00:00Z',
      }),
    )

    await registerMatchResult('match-1', { walkover: 'registration1' })

    expect(apiFetchMock).toHaveBeenCalledWith('/tournament-matches/match-1/result', {
      method: 'POST',
      body: JSON.stringify({ walkover: 'registration1' }),
    })
  })

  it('returns ok=false with the error code and message on failure', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(409, {
        error: 'edit_window_expired',
        message: 'o resultado só pode ser corrigido em até 24h depois de registrado',
      }),
    )

    const result = await registerMatchResult('match-1', { walkover: 'registration1' })

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: 'edit_window_expired',
      message: 'o resultado só pode ser corrigido em até 24h depois de registrado',
    })
  })
})

function matchDetailWire(overrides: Record<string, unknown> = {}) {
  return {
    id: 'match-1',
    category_id: 'cat-1',
    phase: 'bracket',
    round: 1,
    bracket_type: null,
    group_id: null,
    position_in_round: 1,
    registration1_id: 'reg-1',
    registration2_id: 'reg-2',
    winner_registration_id: null,
    next_match_id: null,
    next_match_slot: null,
    loser_next_match_id: null,
    status: 'pending',
    court_id: 'court-1',
    scheduled_at: '2026-07-25T14:00:00Z',
    created_at: '2026-07-20T10:00:00Z',
    sets: [{ set_number: 1, registration1_score: 7, registration2_score: 5 }],
    registration1_name: 'Julia / Fer',
    registration2_name: 'Camila / Rê',
    ...overrides,
  }
}

function matchDetailCamel(overrides: Record<string, unknown> = {}) {
  return {
    id: 'match-1',
    categoryId: 'cat-1',
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
    courtId: 'court-1',
    scheduledAt: '2026-07-25T14:00:00Z',
    createdAt: '2026-07-20T10:00:00Z',
    sets: [{ setNumber: 1, registration1Score: 7, registration2Score: 5 }],
    registration1Name: 'Julia / Fer',
    registration2Name: 'Camila / Rê',
    ...overrides,
  }
}

describe('listCategoryMatches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('GETs /tournament-categories/{id}/matches via plain fetch (visitor-safe) and maps to camelCase', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse(200, { category_id: 'cat-1', matches: [matchDetailWire()] }),
    )

    const result = await listCategoryMatches('cat-1')

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/tournament-categories/cat-1/matches'),
      expect.objectContaining({ credentials: 'include' }),
    )
    expect(apiFetchMock).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: true, categoryId: 'cat-1', matches: [matchDetailCamel()] })
  })

  it('returns ok=false on failure without throwing', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse(404, { error: 'category_not_found' }),
    )

    const result = await listCategoryMatches('cat-1')

    expect(result).toEqual({ ok: false, status: 404, error: 'category_not_found' })
  })
})

describe('getMatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('GETs /tournament-matches/{id} via plain fetch (visitor-safe) and maps to camelCase, including sets and names', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse(200, matchDetailWire()))

    const result = await getMatch('match-1')

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/tournament-matches/match-1'),
      expect.objectContaining({ credentials: 'include' }),
    )
    expect(result).toEqual({ ok: true, match: matchDetailCamel() })
  })

  it('returns ok=false on failure without throwing', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse(404, { error: 'match_not_found' }),
    )

    const result = await getMatch('match-1')

    expect(result).toEqual({ ok: false, status: 404, error: 'match_not_found' })
  })
})

describe('getTournamentBracketInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('GETs /tournaments/{id} via plain fetch (visitor-safe) and maps categories with bracketFormat', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse(200, {
        id: 'tournament-1',
        name: 'Copa Areia Dourada',
        status: 'em_andamento',
        categories: [
          {
            id: 'cat-1',
            name: 'Feminina B',
            skill_tier: 'b',
            gender_scope: 'feminino',
            modality: 'duplas',
            bracket_format: 'single_elimination',
          },
        ],
      }),
    )

    const result = await getTournamentBracketInfo('tournament-1')

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/tournaments/tournament-1'),
      expect.objectContaining({ credentials: 'include' }),
    )
    expect(result).toEqual({
      ok: true,
      tournament: {
        id: 'tournament-1',
        name: 'Copa Areia Dourada',
        status: 'em_andamento',
        categories: [
          {
            id: 'cat-1',
            name: 'Feminina B',
            skillTier: 'b',
            genderScope: 'feminino',
            modality: 'duplas',
            bracketFormat: 'single_elimination',
          },
        ],
      },
    })
  })

  it('returns ok=false on failure without throwing', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse(404, { error: 'tournament_not_found' }),
    )

    const result = await getTournamentBracketInfo('tournament-1')

    expect(result).toEqual({ ok: false, status: 404, error: 'tournament_not_found' })
  })
})
