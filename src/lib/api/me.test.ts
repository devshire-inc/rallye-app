import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import { getMe } from './me'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('getMe', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GETs /me and returns the caller profile id and full_name', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, { id: 'profile-123', full_name: 'Ana Beatriz' }),
    )

    const result = await getMe()

    expect(apiFetchMock).toHaveBeenCalledWith('/me')
    expect(result).toEqual({ ok: true, id: 'profile-123', fullName: 'Ana Beatriz' })
  })

  it('returns ok=false without throwing on failure (e.g. 403 for temporary sessions)', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(403, { error: 'forbidden', message: 'sessão temporária não tem profile id' }))

    const result = await getMe()

    expect(result).toEqual({
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'sessão temporária não tem profile id',
    })
  })
})
