import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import { listSkillLevels, patchSkillLevel } from './skillLevels'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('listSkillLevels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GETs /students/{id}/skill-levels and maps the wire shape to camelCase', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        skill_levels: [
          {
            sport: 'beach_tennis',
            tier: 'b',
            updated_by: 'user-1',
            updated_at: '2026-07-01T00:00:00Z',
          },
          {
            sport: 'padel',
            tier: 'pe_na_areia',
            updated_by: null,
            updated_at: '2026-07-02T00:00:00Z',
          },
        ],
      }),
    )

    const result = await listSkillLevels('student-1')

    expect(result).toEqual({
      ok: true,
      skillLevels: [
        {
          sport: 'beach_tennis',
          tier: 'b',
          updatedBy: 'user-1',
          updatedAt: '2026-07-01T00:00:00Z',
        },
        { sport: 'padel', tier: 'pe_na_areia', updatedBy: null, updatedAt: '2026-07-02T00:00:00Z' },
      ],
    })
    expect(apiFetchMock).toHaveBeenCalledWith('/students/student-1/skill-levels')
  })

  it('maps a failure response to ApiFailure', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(403, { error: 'forbidden' }))

    const result = await listSkillLevels('student-1')

    expect(result).toEqual({ ok: false, status: 403, error: 'forbidden' })
  })
})

describe('patchSkillLevel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('PATCHes /students/{id}/skill-levels/{sport} with { tier } and maps the response', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        sport: 'beach_tennis',
        tier: 'a',
        updated_by: 'user-1',
        updated_at: '2026-07-18T00:00:00Z',
      }),
    )

    const result = await patchSkillLevel('student-1', 'beach_tennis', 'a')

    expect(result).toEqual({
      ok: true,
      skillLevel: {
        sport: 'beach_tennis',
        tier: 'a',
        updatedBy: 'user-1',
        updatedAt: '2026-07-18T00:00:00Z',
      },
    })
    expect(apiFetchMock).toHaveBeenCalledWith('/students/student-1/skill-levels/beach_tennis', {
      method: 'PATCH',
      body: JSON.stringify({ tier: 'a' }),
    })
  })

  it('maps a failure response to ApiFailure', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(400, { error: 'invalid_body' }))

    const result = await patchSkillLevel('student-1', 'beach_tennis', 'a')

    expect(result).toEqual({ ok: false, status: 400, error: 'invalid_body' })
  })
})
