import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import { patchRemuneration } from './remuneration'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('patchRemuneration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('PATCHes /teachers/{id}/remuneration with the mapped snake_case body', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        teacher_id: 'teacher-1',
        remuneration_model: 'fixed',
        remuneration_value: 3500,
        history_row_created: true,
      }),
    )

    const result = await patchRemuneration('teacher-1', {
      remunerationModel: 'fixed',
      remunerationValue: 3500,
    })

    expect(result).toEqual({
      ok: true,
      remunerationModel: 'fixed',
      remunerationValue: 3500,
      historyRowCreated: true,
    })
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/teachers/teacher-1/remuneration',
      expect.objectContaining({ method: 'PATCH' }),
    )
    const [, init] = apiFetchMock.mock.calls[0]
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({ remuneration_model: 'fixed', remuneration_value: 3500 })
  })

  it('returns a failure result on 403 (caller without professores:write)', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(403, { error: 'forbidden' }))

    const result = await patchRemuneration('teacher-1', {
      remunerationModel: 'fixed',
      remunerationValue: 3500,
    })

    expect(result).toEqual({ ok: false, status: 403, error: 'forbidden', message: undefined })
  })
})
