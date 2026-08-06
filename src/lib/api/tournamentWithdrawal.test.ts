import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

// Só `apiFetch` é dublado: `buildHeaders` (que passou a montar os headers
// destas leituras, incluindo o `X-Rallye-Unit`) vem do módulo REAL, para os
// testes exercitarem a injeção de verdade em vez de uma imitação dela.
vi.mock('../httpClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../httpClient')>()),
  apiFetch: apiFetchMock,
}))

import {
  getTournament,
  listCategoryRegistrations,
  withdrawRegistration,
} from './tournamentWithdrawal'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('getTournament', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('GETs /tournaments/{id} via a plain fetch (not apiFetch) and maps snake_case to camelCase', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse(200, {
        id: 'tournament-1',
        unit_id: 'unit-1',
        name: 'Copa Areia Dourada',
        sport: 'beach_tennis',
        type: 'aberto',
        start_date: '2026-07-12',
        end_date: '2026-07-14',
        court_ids: ['court-1', 'court-2'],
        rules: 'Eliminatória simples',
        status: 'em_andamento',
        entry_fee: 80,
        categories: [{ id: 'cat-1', tournament_id: 'tournament-1', name: 'Mista', max_participants: 32 }],
      }),
    )

    const result = await getTournament('tournament-1')

    expect(result).toEqual({
      ok: true,
      tournament: {
        id: 'tournament-1',
        unitId: 'unit-1',
        name: 'Copa Areia Dourada',
        sport: 'beach_tennis',
        type: 'aberto',
        startDate: '2026-07-12',
        endDate: '2026-07-14',
        courtIds: ['court-1', 'court-2'],
        rules: 'Eliminatória simples',
        status: 'em_andamento',
        entryFee: 80,
        categories: [{ id: 'cat-1', tournamentId: 'tournament-1', name: 'Mista', maxParticipants: 32 }],
      },
    })
    // Nunca via apiFetch — visitante/sessão temporária não podem disparar o
    // interceptor de refresh/redirect-to-login (ver comentário de topo do
    // arquivo fonte).
    expect(apiFetchMock).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/tournaments/tournament-1'),
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('returns ok:false (never throws) when unauthenticated — 401 anônimo', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse(401, { error: 'unauthorized' }))

    const result = await getTournament('tournament-1')

    expect(result).toEqual({ ok: false, status: 401, error: 'unauthorized' })
  })
})

describe('listCategoryRegistrations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('GETs /tournament-categories/{id}/registrations via plain fetch and maps the wire shape', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse(200, {
        category_id: 'cat-1',
        registrations: [
          {
            id: 'reg-1',
            category_id: 'cat-1',
            player1_id: 'user-1',
            player2_id: 'user-2',
            player2_manual_name: null,
            player2_manual_email: null,
            status: 'confirmed',
            invoice_id: 'invoice-1',
          },
        ],
      }),
    )

    const result = await listCategoryRegistrations('cat-1')

    expect(result).toEqual({
      ok: true,
      registrations: [
        {
          id: 'reg-1',
          categoryId: 'cat-1',
          player1Id: 'user-1',
          player2Id: 'user-2',
          player2ManualName: null,
          player2ManualEmail: null,
          status: 'confirmed',
          invoiceId: 'invoice-1',
        },
      ],
    })
    expect(apiFetchMock).not.toHaveBeenCalled()
  })

  it('returns ok:false gracefully on 409 (sessão temporária sem membership, BEAC-1991)', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      jsonResponse(409, { error: 'arena_selection_required' }),
    )

    const result = await listCategoryRegistrations('cat-1')

    expect(result).toEqual({ ok: false, status: 409, error: 'arena_selection_required' })
  })
})

describe('withdrawRegistration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POSTs refund_type=total via apiFetch, sem amount', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, { id: 'reg-1', status: 'withdrawn' }))

    const result = await withdrawRegistration('reg-1', 'total')

    expect(result).toEqual({ ok: true, status: 'withdrawn' })
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/tournament-registrations/reg-1/withdraw',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ refund_type: 'total' }),
      }),
    )
  })

  it('POSTs refund_type=parcial com amount', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, { id: 'reg-1', status: 'withdrawn' }))

    const result = await withdrawRegistration('reg-1', 'parcial', 40)

    expect(result).toEqual({ ok: true, status: 'withdrawn' })
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/tournament-registrations/reg-1/withdraw',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ refund_type: 'parcial', amount: 40 }),
      }),
    )
  })

  it('POSTs refund_type=nenhum, sem amount', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, { id: 'reg-1', status: 'withdrawn' }))

    const result = await withdrawRegistration('reg-1', 'nenhum')

    expect(result).toEqual({ ok: true, status: 'withdrawn' })
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/tournament-registrations/reg-1/withdraw',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ refund_type: 'nenhum' }),
      }),
    )
  })

  it('propagates a business-rule conflict (ex.: janela de estorno expirada) sem mascarar', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(409, { error: 'refund_window_expired', message: 'Janela de 7 dias expirada' }),
    )

    const result = await withdrawRegistration('reg-1', 'total')

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: 'refund_window_expired',
      message: 'Janela de 7 dias expirada',
    })
  })
})
