import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import { fetchStudentXP } from './xp'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('fetchStudentXP', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GETs /students/{id}/xp and returns the typed total_xp/medal on success', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, { total_xp: 420, medal: 'Ouro' }))

    const result = await fetchStudentXP('student-1')

    expect(result).toEqual({ ok: true, total_xp: 420, medal: 'Ouro' })
    expect(apiFetchMock).toHaveBeenCalledWith('/students/student-1/xp')
  })

  it('returns an ApiFailure on a non-2xx response, never fabricating a medal', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(403, { error: 'forbidden' }))

    const result = await fetchStudentXP('student-1')

    expect(result).toEqual({ ok: false, status: 403, error: 'forbidden' })
  })
})
