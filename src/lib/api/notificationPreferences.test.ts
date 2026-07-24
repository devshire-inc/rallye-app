import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import { getNotificationPreferences, patchNotificationPreferences } from './notificationPreferences'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('getNotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GETs /me/notification-preferences and converts wire fields to camelCase', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        channels: [
          { channel: 'push', enabled: true },
          { channel: 'whatsapp', enabled: false },
        ],
        events: [
          { event_type: 'vaga_waitlist', enabled: true },
          { event_type: 'torneio_ranking_atualizado', enabled: false },
        ],
      }),
    )

    const result = await getNotificationPreferences()

    expect(apiFetchMock).toHaveBeenCalledWith('/me/notification-preferences')
    expect(result).toEqual({
      ok: true,
      channels: [
        { channel: 'push', enabled: true },
        { channel: 'whatsapp', enabled: false },
      ],
      events: [
        { eventType: 'vaga_waitlist', enabled: true },
        { eventType: 'torneio_ranking_atualizado', enabled: false },
      ],
    })
  })

  it('returns ok=false on failure without throwing', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(500, { error: 'internal_error' }))

    const result = await getNotificationPreferences()

    expect(result).toEqual({ ok: false, status: 500, error: 'internal_error', message: undefined })
  })
})

describe('patchNotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('PATCHes only the fields provided, converted to snake_case wire shape', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        channels: [{ channel: 'push', enabled: true }],
        events: [{ event_type: 'vaga_waitlist', enabled: false }],
      }),
    )

    const result = await patchNotificationPreferences({
      events: [{ eventType: 'vaga_waitlist', enabled: false }],
    })

    expect(apiFetchMock).toHaveBeenCalledWith('/me/notification-preferences', {
      method: 'PATCH',
      body: JSON.stringify({ events: [{ event_type: 'vaga_waitlist', enabled: false }] }),
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.events).toEqual([{ eventType: 'vaga_waitlist', enabled: false }])
    }
  })

  it('omits channels/events keys entirely when not provided (no accidental overwrite)', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, { channels: [], events: [] }))

    await patchNotificationPreferences({ channels: [{ channel: 'whatsapp', enabled: true }] })

    expect(apiFetchMock).toHaveBeenCalledWith('/me/notification-preferences', {
      method: 'PATCH',
      body: JSON.stringify({ channels: [{ channel: 'whatsapp', enabled: true }] }),
    })
  })

  it('returns ok=false on failure without throwing', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(400, { error: 'invalid_body', message: 'channel inválido' }))

    const result = await patchNotificationPreferences({ channels: [{ channel: 'push', enabled: true }] })

    expect(result).toEqual({ ok: false, status: 400, error: 'invalid_body', message: 'channel inválido' })
  })
})
