import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import { createPlan, getPlan, getPlanForEdit, listPlans, patchPlan } from './plans'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('listPlans', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GETs /units/{id}/plans and maps groups/plans from snake_case to camelCase', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, [
        {
          sport: 'beach_tennis',
          plans: [
            {
              id: 'plan-1',
              name: '3x/semana',
              type: 'mensalidade',
              sport: 'beach_tennis',
              max_members: 1,
              is_active: true,
              variant_count: 6,
              active_subscriber_count: 82,
              starting_price: 280,
            },
          ],
        },
        { sport: null, plans: [] },
      ]),
    )

    const result = await listPlans('unit-1')

    expect(apiFetchMock).toHaveBeenCalledWith('/units/unit-1/plans')
    expect(result).toEqual({
      ok: true,
      groups: [
        {
          sport: 'beach_tennis',
          plans: [
            {
              id: 'plan-1',
              name: '3x/semana',
              type: 'mensalidade',
              sport: 'beach_tennis',
              maxMembers: 1,
              isActive: true,
              variantCount: 6,
              activeSubscriberCount: 82,
              startingPrice: 280,
            },
          ],
        },
        { sport: null, plans: [] },
      ],
    })
  })

  it('returns ok=false on failure without throwing', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(403, { error: 'forbidden' }))

    const result = await listPlans('unit-1')

    expect(result).toEqual({ ok: false, status: 403, error: 'forbidden', message: undefined })
  })
})

describe('createPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POSTs /units/{id}/plans with the variants list in wire format', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(201, {
        id: 'plan-1',
        unit_id: 'unit-1',
        name: '3x por semana - Beach Tennis',
        type: 'mensalidade',
        sport: 'beach_tennis',
        max_members: 1,
        description: null,
        is_active: true,
        variants: [
          {
            id: 'variant-1',
            plan_id: 'plan-1',
            billing_cycle: 'trimestral',
            base_price: 350,
            discount_percent: 10,
            final_price: 315,
            sessions_per_week: 3,
            total_sessions: null,
            is_active: true,
          },
        ],
      }),
    )

    const result = await createPlan('unit-1', {
      name: '3x por semana - Beach Tennis',
      type: 'mensalidade',
      sport: 'beach_tennis',
      variants: [
        { billingCycle: 'trimestral', basePrice: 350, discountPercent: 10, sessionsPerWeek: 3 },
      ],
    })

    expect(apiFetchMock).toHaveBeenCalledWith('/units/unit-1/plans', {
      method: 'POST',
      body: JSON.stringify({
        name: '3x por semana - Beach Tennis',
        type: 'mensalidade',
        sport: 'beach_tennis',
        max_members: undefined,
        description: undefined,
        variants: [
          {
            base_price: 350,
            billing_cycle: 'trimestral',
            discount_percent: 10,
            sessions_per_week: 3,
          },
        ],
      }),
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plan.variants[0].finalPrice).toBe(315)
    }
  })
})

describe('getPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GETs /plans/{id} (BEAC-1976) and maps the plan+variants from snake_case to camelCase', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        id: 'plan-1',
        unit_id: 'unit-1',
        name: '3x por semana - Beach Tennis',
        type: 'mensalidade',
        sport: 'beach_tennis',
        max_members: 1,
        description: null,
        is_active: true,
        variants: [
          {
            id: 'variant-1',
            plan_id: 'plan-1',
            billing_cycle: 'trimestral',
            base_price: 350,
            discount_percent: 10,
            final_price: 315,
            sessions_per_week: 3,
            total_sessions: null,
            is_active: true,
          },
        ],
      }),
    )

    const result = await getPlan('plan-1')

    expect(apiFetchMock).toHaveBeenCalledWith('/plans/plan-1')
    expect(result).toEqual({
      ok: true,
      plan: {
        id: 'plan-1',
        unitId: 'unit-1',
        name: '3x por semana - Beach Tennis',
        type: 'mensalidade',
        sport: 'beach_tennis',
        maxMembers: 1,
        description: null,
        isActive: true,
        variants: [
          {
            id: 'variant-1',
            planId: 'plan-1',
            billingCycle: 'trimestral',
            basePrice: 350,
            discountPercent: 10,
            finalPrice: 315,
            sessionsPerWeek: 3,
            totalSessions: null,
            isActive: true,
          },
        ],
      },
    })
  })

  it('returns ok=false on failure without throwing (e.g. plan from another unit -> 404)', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(404, { error: 'plan_not_found' }))

    const result = await getPlan('plan-1')

    expect(result).toEqual({ ok: false, status: 404, error: 'plan_not_found', message: undefined })
  })
})

describe('getPlanForEdit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('delegates to GET /plans/{id} (BEAC-1976 — no longer the empty-PATCH workaround)', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        id: 'plan-1',
        unit_id: 'unit-1',
        name: 'Plano X',
        type: 'mensalidade',
        sport: null,
        max_members: 1,
        description: null,
        is_active: true,
        variants: [],
      }),
    )

    const result = await getPlanForEdit('plan-1')

    expect(apiFetchMock).toHaveBeenCalledWith('/plans/plan-1')
    expect(apiFetchMock).not.toHaveBeenCalledWith(
      '/plans/plan-1',
      expect.objectContaining({ method: 'PATCH' }),
    )
    expect(result.ok).toBe(true)
  })
})

describe('patchPlan', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('PATCHes /plans/{id} sending only the fields provided', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        id: 'plan-1',
        unit_id: 'unit-1',
        name: 'Plano Renomeado',
        type: 'mensalidade',
        sport: 'beach_tennis',
        max_members: 1,
        description: null,
        is_active: true,
        variants: [],
      }),
    )

    const result = await patchPlan('plan-1', { name: 'Plano Renomeado' })

    expect(apiFetchMock).toHaveBeenCalledWith('/plans/plan-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Plano Renomeado' }),
    })
    expect(result).toEqual({
      ok: true,
      plan: {
        id: 'plan-1',
        unitId: 'unit-1',
        name: 'Plano Renomeado',
        type: 'mensalidade',
        sport: 'beach_tennis',
        maxMembers: 1,
        description: null,
        isActive: true,
        variants: [],
      },
    })
  })
})
