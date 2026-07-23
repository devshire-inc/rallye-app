import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import { getRankings } from './rankings'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('getRankings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GETs /rankings?scope=arena&unit_id= and maps the wire shape to camelCase', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        scope: 'arena',
        rankings: [
          { student_id: 'stu-1', name: 'Ana Silva', total_points: 340 },
          { student_id: 'stu-2', name: 'Bruno Costa', total_points: 210 },
        ],
      }),
    )

    const result = await getRankings({ scope: 'arena', unitId: 'unit-1' })

    expect(apiFetchMock).toHaveBeenCalledWith('/rankings?scope=arena&unit_id=unit-1')
    expect(result).toEqual({
      ok: true,
      scope: 'arena',
      rankings: [
        { studentId: 'stu-1', name: 'Ana Silva', totalPoints: 340 },
        { studentId: 'stu-2', name: 'Bruno Costa', totalPoints: 210 },
      ],
    })
  })

  it('GETs /rankings?scope=cidade&city= for cidade scope', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, { scope: 'cidade', rankings: [] }))

    await getRankings({ scope: 'cidade', city: 'São Paulo' })

    expect(apiFetchMock).toHaveBeenCalledWith('/rankings?scope=cidade&city=S%C3%A3o+Paulo')
  })

  it('GETs /rankings?scope=nacional with no extra param', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, { scope: 'nacional', rankings: [] }))

    await getRankings({ scope: 'nacional' })

    expect(apiFetchMock).toHaveBeenCalledWith('/rankings?scope=nacional')
  })

  it('returns ok=false on failure without throwing', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(403, { error: 'forbidden' }))

    const result = await getRankings({ scope: 'arena', unitId: 'unit-1' })

    expect(result).toEqual({ ok: false, status: 403, error: 'forbidden' })
  })
})
