import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import { createUnit } from './units'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('createUnit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POSTs to /tenants/{id}/units with the mapped snake_case body', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(201, { id: 'unit-123' }))

    const result = await createUnit('tenant-1', {
      name: 'Unidade Sul',
      address: 'Rua X, 100',
      phone: '+5511999990000',
      timezone: 'America/Sao_Paulo',
      sportsOffered: ['beach_tennis'],
      operatingHours: { summary: 'Seg–Dom · 06:00–22:00' },
    })

    expect(result).toEqual({ ok: true, id: 'unit-123' })
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/tenants/tenant-1/units',
      expect.objectContaining({ method: 'POST' }),
    )
    const [, init] = apiFetchMock.mock.calls[0]
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({
      name: 'Unidade Sul',
      address: 'Rua X, 100',
      phone: '+5511999990000',
      timezone: 'America/Sao_Paulo',
      sports_offered: ['beach_tennis'],
      operating_hours: { summary: 'Seg–Dom · 06:00–22:00' },
    })
  })

  it('sends operating_hours as a JSON object on the wire, not a double-encoded string', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(201, { id: 'unit-123' }))

    await createUnit('tenant-1', {
      name: 'Unidade Sul',
      operatingHours: { summary: 'Seg–Dom · 06:00–22:00' },
    })

    const [, init] = apiFetchMock.mock.calls[0]
    const body = JSON.parse(init.body as string)
    // Regression guard: operating_hours must be a JSON object, not a string
    // containing escaped JSON text (double-encoding bug).
    expect(typeof body.operating_hours).toBe('object')
    expect(body.operating_hours).toEqual({ summary: 'Seg–Dom · 06:00–22:00' })
  })

  it('returns ok=false with status 403 when the caller is not the tenant owner', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(403, { error: 'forbidden' }))

    const result = await createUnit('tenant-1', { name: 'Unidade Sul' })

    expect(result).toEqual({ ok: false, status: 403, error: 'forbidden' })
  })

  it('returns ok=false on unexpected/non-JSON error responses without throwing', async () => {
    apiFetchMock.mockResolvedValue(new Response('not json', { status: 500 }))

    const result = await createUnit('tenant-1', { name: 'Unidade Sul' })

    expect(result).toEqual({ ok: false, status: 500, error: 'unknown_error' })
  })
})
