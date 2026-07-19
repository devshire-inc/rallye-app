import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import { createTeacherBlockRequest } from './blockRequests'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('createTeacherBlockRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POSTs /teachers/{id}/block-requests with the wire-shaped payload and maps the response', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(201, {
        id: 'req-1',
        status: 'pending',
        created_at: '2026-07-18T12:00:00Z',
      }),
    )

    const result = await createTeacherBlockRequest('teacher-1', {
      startDate: '2026-07-20T10:00:00.000Z',
      endDate: '2026-07-22T10:00:00.000Z',
      reason: 'Consulta médica',
    })

    expect(result).toEqual({
      ok: true,
      id: 'req-1',
      status: 'pending',
      createdAt: '2026-07-18T12:00:00Z',
    })
    expect(apiFetchMock).toHaveBeenCalledWith('/teachers/teacher-1/block-requests', {
      method: 'POST',
      body: JSON.stringify({
        start_date: '2026-07-20T10:00:00.000Z',
        end_date: '2026-07-22T10:00:00.000Z',
        reason: 'Consulta médica',
      }),
    })
  })

  it('maps a failure response (missing reason) to ApiFailure with the message', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(400, {
        error: 'invalid_body',
        message: 'Conte o motivo pra o admin decidir.',
      }),
    )

    const result = await createTeacherBlockRequest('teacher-1', {
      startDate: '2026-07-20T10:00:00.000Z',
      endDate: '2026-07-22T10:00:00.000Z',
      reason: '',
    })

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'invalid_body',
      message: 'Conte o motivo pra o admin decidir.',
    })
  })

  it('maps a forbidden response (creating for another teacher) to ApiFailure', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(403, { error: 'forbidden' }))

    const result = await createTeacherBlockRequest('other-teacher', {
      startDate: '2026-07-20T10:00:00.000Z',
      endDate: '2026-07-22T10:00:00.000Z',
      reason: 'Tentando para outro',
    })

    expect(result).toEqual({ ok: false, status: 403, error: 'forbidden', message: undefined })
  })
})
