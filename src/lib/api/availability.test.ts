import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import { getAvailability, patchAvailability } from './availability'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('getAvailability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GETs /teachers/{id}/availability and maps the wire shape to camelCase', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        availability: [
          { day_of_week: 1, time_slot: '08-10', available: true },
          { day_of_week: 1, time_slot: '10-12', available: false },
        ],
      }),
    )

    const result = await getAvailability('teacher-1')

    expect(result).toEqual({
      ok: true,
      availability: [
        { dayOfWeek: 1, timeSlot: '08-10', available: true },
        { dayOfWeek: 1, timeSlot: '10-12', available: false },
      ],
    })
    expect(apiFetchMock).toHaveBeenCalledWith('/teachers/teacher-1/availability')
  })

  it('maps a failure response to ApiFailure', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(403, { error: 'forbidden' }))

    const result = await getAvailability('teacher-1')

    expect(result).toEqual({ ok: false, status: 403, error: 'forbidden' })
  })
})

describe('patchAvailability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('PATCHes /teachers/{id}/availability with { slots } and maps the response', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        availability: [{ day_of_week: 2, time_slot: '14-16', available: true }],
      }),
    )

    const result = await patchAvailability('teacher-1', [
      { dayOfWeek: 2, timeSlot: '14-16', available: true },
    ])

    expect(result).toEqual({
      ok: true,
      availability: [{ dayOfWeek: 2, timeSlot: '14-16', available: true }],
    })
    expect(apiFetchMock).toHaveBeenCalledWith('/teachers/teacher-1/availability', {
      method: 'PATCH',
      body: JSON.stringify({ slots: [{ day_of_week: 2, time_slot: '14-16', available: true }] }),
    })
  })

  it('maps a failure response to ApiFailure', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(400, { error: 'invalid_body' }))

    const result = await patchAvailability('teacher-1', [
      { dayOfWeek: 2, timeSlot: '14-16', available: true },
    ])

    expect(result).toEqual({ ok: false, status: 400, error: 'invalid_body' })
  })
})
