import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import { listClasses } from './classes'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('listClasses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GETs /units/{id}/classes without a query string when teacherId is omitted', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, []))

    await listClasses('unit-1')

    expect(apiFetchMock).toHaveBeenCalledWith('/units/unit-1/classes')
  })

  it('appends ?teacher_id= when provided (BEAC-1880/PR2 aba Turmas)', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, []))

    await listClasses('unit-1', 'teacher-1')

    expect(apiFetchMock).toHaveBeenCalledWith('/units/unit-1/classes?teacher_id=teacher-1')
  })
})
