import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import { listCourts } from './courts'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('listCourts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GETs /units/{id}/courts and maps the wire shape to camelCase', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, [
        { id: 'court-1', unit_id: 'unit-1', name: 'Quadra 1', sport: 'beach_tennis', status: 'active' },
        { id: 'court-3', unit_id: 'unit-1', name: 'Quadra 3', sport: 'beach_tennis', status: 'maintenance' },
      ]),
    )

    const result = await listCourts('unit-1')

    expect(apiFetchMock).toHaveBeenCalledWith('/units/unit-1/courts')
    expect(result).toEqual({
      ok: true,
      courts: [
        { id: 'court-1', unitId: 'unit-1', name: 'Quadra 1', sport: 'beach_tennis', status: 'active' },
        { id: 'court-3', unitId: 'unit-1', name: 'Quadra 3', sport: 'beach_tennis', status: 'maintenance' },
      ],
    })
  })

  it('returns ok=false on failure without throwing', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(403, { error: 'forbidden' }))

    const result = await listCourts('unit-1')

    expect(result).toEqual({ ok: false, status: 403, error: 'forbidden' })
  })
})
