import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import { getEarnings } from './earnings'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('getEarnings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GETs /teachers/{id}/earnings and maps every field to camelCase', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        remuneration_model: 'commission',
        classes_given_in_period: 42,
        revenue_generated: null,
        pending_amount: 150,
        paid_amount: 200,
        current_month_amount: 1200,
        history: [
          { period: '2026-02-01', amount: 0 },
          { period: '2026-03-01', amount: 3310 },
          { period: '2026-04-01', amount: 3560 },
          { period: '2026-05-01', amount: 3310 },
          { period: '2026-06-01', amount: 3560 },
          { period: '2026-07-01', amount: 0 },
        ],
        breakdown: [
          { class_id: 'class-1', class_name: 'BT intermediária', class_count: 18, amount: 1620 },
        ],
      }),
    )

    const result = await getEarnings('teacher-1')

    expect(result).toEqual({
      ok: true,
      earnings: {
        remunerationModel: 'commission',
        classesGivenInPeriod: 42,
        revenueGenerated: null,
        pendingAmount: 150,
        paidAmount: 200,
        currentMonthAmount: 1200,
        history: [
          { period: '2026-02-01', amount: 0 },
          { period: '2026-03-01', amount: 3310 },
          { period: '2026-04-01', amount: 3560 },
          { period: '2026-05-01', amount: 3310 },
          { period: '2026-06-01', amount: 3560 },
          { period: '2026-07-01', amount: 0 },
        ],
        breakdown: [
          { classId: 'class-1', className: 'BT intermediária', classCount: 18, amount: 1620 },
        ],
      },
    })
    expect(apiFetchMock).toHaveBeenCalledWith('/teachers/teacher-1/earnings')
  })

  it('defaults breakdown to an empty array when the wire body omits it', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        remuneration_model: 'fixed',
        classes_given_in_period: 0,
        revenue_generated: null,
        pending_amount: 0,
        paid_amount: 0,
        current_month_amount: 3000,
        history: [],
      }),
    )

    const result = await getEarnings('teacher-1')

    expect(result.ok && result.earnings.breakdown).toEqual([])
  })

  it('returns a failure result on 403', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(403, { error: 'forbidden' }))

    const result = await getEarnings('teacher-1')

    expect(result).toEqual({ ok: false, status: 403, error: 'forbidden' })
  })
})
