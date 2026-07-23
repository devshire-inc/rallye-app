import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import {
  createTournament,
  getTournament,
  listTournaments,
  patchTournament,
  patchTournamentCategories,
  patchTournamentRankingRules,
  publishTournament,
} from './tournaments'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function tournamentWire(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tournament-1',
    unit_id: 'unit-1',
    name: 'Copa Primavera',
    sport: 'beach_tennis',
    type: 'fechado',
    start_date: '2026-09-20',
    end_date: '2026-09-21',
    court_ids: ['court-1'],
    banner_url: null,
    rules: null,
    status: 'rascunho',
    entry_fee: 80,
    registration_opens_at: '2026-08-20T00:00:00-03:00',
    registration_closes_at: '2026-09-15T23:59:59-03:00',
    requires_payment: true,
    bracket_format: 'single_elimination',
    use_ranking_points: true,
    created_by: 'user-1',
    created_at: '2026-07-23T10:00:00Z',
    categories: [],
    ranking_rules: [
      { id: 'rr-1', tournament_id: 'tournament-1', placement: 'campeao', points: 100 },
    ],
    ...overrides,
  }
}

const tournamentDetail = {
  id: 'tournament-1',
  unitId: 'unit-1',
  name: 'Copa Primavera',
  sport: 'beach_tennis',
  type: 'fechado',
  startDate: '2026-09-20',
  endDate: '2026-09-21',
  courtIds: ['court-1'],
  bannerUrl: null,
  rules: null,
  status: 'rascunho',
  entryFee: 80,
  registrationOpensAt: '2026-08-20T00:00:00-03:00',
  registrationClosesAt: '2026-09-15T23:59:59-03:00',
  requiresPayment: true,
  bracketFormat: 'single_elimination',
  useRankingPoints: true,
  createdBy: 'user-1',
  createdAt: '2026-07-23T10:00:00Z',
  categories: [],
  rankingRules: [{ id: 'rr-1', tournamentId: 'tournament-1', placement: 'campeao', points: 100 }],
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createTournament', () => {
  it('POSTs /units/{id}/tournaments with snake_case body and maps the response', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(201, tournamentWire()))

    const result = await createTournament('unit-1', {
      name: 'Copa Primavera',
      sport: 'beach_tennis',
      type: 'fechado',
      startDate: '2026-09-20',
      endDate: '2026-09-21',
      bracketFormat: 'single_elimination',
      courtIds: ['court-1'],
      entryFee: 80,
      registrationOpensAt: '2026-08-20T00:00:00-03:00',
      registrationClosesAt: '2026-09-15T23:59:59-03:00',
      requiresPayment: true,
    })

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/units/unit-1/tournaments',
      expect.objectContaining({ method: 'POST' }),
    )
    const sentBody = JSON.parse(apiFetchMock.mock.calls[0][1].body)
    expect(sentBody).toMatchObject({
      name: 'Copa Primavera',
      sport: 'beach_tennis',
      type: 'fechado',
      start_date: '2026-09-20',
      end_date: '2026-09-21',
      bracket_format: 'single_elimination',
      court_ids: ['court-1'],
      entry_fee: 80,
      requires_payment: true,
    })
    expect(result).toEqual({ ok: true, tournament: tournamentDetail })
  })

  it('returns ok=false with the validation message on 400', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(400, { error: 'invalid_body', message: 'name é obrigatório' }),
    )

    const result = await createTournament('unit-1', {
      name: '',
      sport: 'beach_tennis',
      type: 'fechado',
      startDate: '2026-09-20',
      endDate: '2026-09-21',
      bracketFormat: 'single_elimination',
    })

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'invalid_body',
      message: 'name é obrigatório',
    })
  })
})

describe('getTournament', () => {
  it('GETs /tournaments/{id} and maps the response', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, tournamentWire()))

    const result = await getTournament('tournament-1')

    expect(apiFetchMock).toHaveBeenCalledWith('/tournaments/tournament-1')
    expect(result).toEqual({ ok: true, tournament: tournamentDetail })
  })

  it('returns ok=false on 404 (rascunho de outro chamador ou inexistente)', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(404, { error: 'tournament_not_found' }))

    const result = await getTournament('tournament-1')

    expect(result).toEqual({ ok: false, status: 404, error: 'tournament_not_found', message: undefined })
  })
})

describe('patchTournament', () => {
  it('PATCHes /tournaments/{id} with snake_case body and maps the response', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, tournamentWire({ name: 'Copa Primavera 2' })))

    const result = await patchTournament('tournament-1', { name: 'Copa Primavera 2' })

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/tournaments/tournament-1',
      expect.objectContaining({ method: 'PATCH' }),
    )
    const sentBody = JSON.parse(apiFetchMock.mock.calls[0][1].body)
    expect(sentBody.name).toBe('Copa Primavera 2')
    expect(result.ok).toBe(true)
    expect(result.ok && result.tournament.name).toBe('Copa Primavera 2')
  })
})

describe('patchTournamentCategories', () => {
  it('PATCHes /tournaments/{id}/categories and maps the returned list', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, [
        {
          id: 'cat-1',
          tournament_id: 'tournament-1',
          name: 'Masculina B',
          skill_tier: 'b',
          gender_scope: 'masculino',
          modality: 'duplas',
          max_participants: 16,
          bracket_format: null,
        },
      ]),
    )

    const result = await patchTournamentCategories('tournament-1', [
      { name: 'Masculina B', genderScope: 'masculino', modality: 'duplas', maxParticipants: 16 },
    ])

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/tournaments/tournament-1/categories',
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(result).toEqual({
      ok: true,
      categories: [
        {
          id: 'cat-1',
          tournamentId: 'tournament-1',
          name: 'Masculina B',
          skillTier: 'b',
          genderScope: 'masculino',
          modality: 'duplas',
          maxParticipants: 16,
          bracketFormat: null,
        },
      ],
    })
  })

  it('returns ok=false (409) when categories are locked', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(409, {
        error: 'tournament_categories_locked',
        message: 'categorias não podem ser editadas com o torneio em em_andamento',
      }),
    )

    const result = await patchTournamentCategories('tournament-1', [])

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: 'tournament_categories_locked',
      message: 'categorias não podem ser editadas com o torneio em em_andamento',
    })
  })
})

describe('patchTournamentRankingRules', () => {
  it('PATCHes /tournaments/{id}/ranking-rules and maps the returned list', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, [
        { id: 'rr-1', tournament_id: 'tournament-1', placement: 'campeao', points: 150 },
      ]),
    )

    const result = await patchTournamentRankingRules('tournament-1', [
      { placement: 'campeao', points: 150 },
    ])

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/tournaments/tournament-1/ranking-rules',
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(result).toEqual({
      ok: true,
      rankingRules: [{ id: 'rr-1', tournamentId: 'tournament-1', placement: 'campeao', points: 150 }],
    })
  })
})

describe('publishTournament', () => {
  it('POSTs /tournaments/{id}/publish and maps the response', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, tournamentWire({ status: 'publicado' })))

    const result = await publishTournament('tournament-1')

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/tournaments/tournament-1/publish',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result.ok).toBe(true)
    expect(result.ok && result.tournament.status).toBe('publicado')
  })

  it('returns ok=false (409) when the tournament is not a draft', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(409, {
        error: 'tournament_not_draft',
        message: 'torneio já está em status publicado',
      }),
    )

    const result = await publishTournament('tournament-1')

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: 'tournament_not_draft',
      message: 'torneio já está em status publicado',
    })
  })
})

describe('listTournaments', () => {
  function listItemWire(overrides: Record<string, unknown> = {}) {
    return {
      id: 'tournament-1',
      name: 'Copa Areia Dourada',
      sport: 'beach_tennis',
      type: 'fechado',
      status: 'em_andamento',
      start_date: '2026-07-12',
      end_date: '2026-07-14',
      registration_opens_at: null,
      registration_closes_at: null,
      champions: null,
      ...overrides,
    }
  }

  it('GETs /units/{id}/tournaments?scope=mine and maps the response', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, { scope: 'mine', tournaments: [listItemWire()] }),
    )

    const result = await listTournaments('unit-1', 'mine')

    expect(apiFetchMock).toHaveBeenCalledWith('/units/unit-1/tournaments?scope=mine')
    expect(result).toEqual({
      ok: true,
      scope: 'mine',
      tournaments: [
        {
          id: 'tournament-1',
          name: 'Copa Areia Dourada',
          sport: 'beach_tennis',
          type: 'fechado',
          status: 'em_andamento',
          startDate: '2026-07-12',
          endDate: '2026-07-14',
          registrationOpensAt: null,
          registrationClosesAt: null,
          champions: null,
        },
      ],
    })
  })

  it('GETs with scope=abertos', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, { scope: 'abertos', tournaments: [] }))

    await listTournaments('unit-1', 'abertos')

    expect(apiFetchMock).toHaveBeenCalledWith('/units/unit-1/tournaments?scope=abertos')
  })

  it('maps champions (only populated for scope=encerrados)', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        scope: 'encerrados',
        tournaments: [
          listItemWire({
            status: 'encerrado',
            champions: [{ category_name: 'Fem B', champion_name: 'Marina & Carla' }],
          }),
        ],
      }),
    )

    const result = await listTournaments('unit-1', 'encerrados')

    expect(result.ok && result.tournaments[0].champions).toEqual([
      { categoryName: 'Fem B', championName: 'Marina & Carla' },
    ])
  })

  it('returns ok=false on failure', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(500, { error: 'internal_error' }))

    const result = await listTournaments('unit-1', 'mine')

    expect(result).toEqual({ ok: false, status: 500, error: 'internal_error', message: undefined })
  })
})
