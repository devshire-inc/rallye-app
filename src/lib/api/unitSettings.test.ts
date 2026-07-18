import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import { getDelinquencyBlockLevel, patchDelinquencyBlockLevel } from './unitSettings'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('getDelinquencyBlockLevel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GETs /units/{id}/settings/delinquency-block-level and returns the wire value as-is', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, { delinquency_block_level: 'total' }))

    const result = await getDelinquencyBlockLevel('unit-1')

    expect(apiFetchMock).toHaveBeenCalledWith('/units/unit-1/settings/delinquency-block-level')
    expect(result).toEqual({ ok: true, level: 'total' })
  })

  it('returns ok=false on failure without throwing', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(403, { error: 'forbidden' }))

    const result = await getDelinquencyBlockLevel('unit-1')

    expect(result).toEqual({ ok: false, status: 403, error: 'forbidden' })
  })
})

describe('patchDelinquencyBlockLevel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('PATCHes the flat snake_case body and returns the persisted value', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, { delinquency_block_level: 'new_bookings_and_checkin' }),
    )

    const result = await patchDelinquencyBlockLevel('unit-1', 'new_bookings_and_checkin')

    expect(apiFetchMock).toHaveBeenCalledWith('/units/unit-1/settings/delinquency-block-level', {
      method: 'PATCH',
      body: JSON.stringify({ delinquency_block_level: 'new_bookings_and_checkin' }),
    })
    expect(result).toEqual({ ok: true, level: 'new_bookings_and_checkin' })
  })

  it('returns ok=false on failure without throwing', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(400, { error: 'invalid_body' }))

    const result = await patchDelinquencyBlockLevel('unit-1', 'total')

    expect(result).toEqual({ ok: false, status: 400, error: 'invalid_body' })
  })
})
