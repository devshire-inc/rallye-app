import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import {
  decideRescheduleCredit,
  decideTeacherBlockRequest,
  listPendingApprovals,
} from './pendingApprovals'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('listPendingApprovals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GETs /units/{id}/pending-approvals and maps mixed types to camelCase', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, [
        {
          id: 'pa-1',
          type: 'teacher_block',
          status: 'pending',
          requested_by: 'teacher-1',
          reviewed_by: null,
          reviewed_at: null,
          created_at: '2026-07-20T10:00:00Z',
          teacher_block: {
            teacher_id: 'teacher-1',
            teacher_name: 'Marcus Lima',
            start_date: '2026-08-01T00:00:00Z',
            end_date: '2026-08-03T00:00:00Z',
            reason: 'Consulta médica',
          },
        },
        {
          id: 'pa-2',
          type: 'reschedule',
          status: 'pending',
          requested_by: 'student-1',
          reviewed_by: null,
          reviewed_at: null,
          created_at: '2026-07-20T11:00:00Z',
          reschedule: {
            student_id: 'student-1',
            student_name: 'Ana Beltrão',
            target_class_name: 'BT sexta 18h',
            target_start_at: '2026-08-01T18:00:00Z',
          },
        },
      ]),
    )

    const result = await listPendingApprovals('unit-1')

    expect(result).toEqual({
      ok: true,
      items: [
        {
          id: 'pa-1',
          type: 'teacher_block',
          status: 'pending',
          requestedBy: 'teacher-1',
          reviewedBy: null,
          reviewedAt: null,
          createdAt: '2026-07-20T10:00:00Z',
          teacherBlock: {
            teacherId: 'teacher-1',
            teacherName: 'Marcus Lima',
            startDate: '2026-08-01T00:00:00Z',
            endDate: '2026-08-03T00:00:00Z',
            reason: 'Consulta médica',
          },
          reschedule: null,
        },
        {
          id: 'pa-2',
          type: 'reschedule',
          status: 'pending',
          requestedBy: 'student-1',
          reviewedBy: null,
          reviewedAt: null,
          createdAt: '2026-07-20T11:00:00Z',
          teacherBlock: null,
          reschedule: {
            studentId: 'student-1',
            studentName: 'Ana Beltrão',
            targetClassName: 'BT sexta 18h',
            targetStartAt: '2026-08-01T18:00:00Z',
          },
        },
      ],
    })
    expect(apiFetchMock).toHaveBeenCalledWith('/units/unit-1/pending-approvals')
  })

  it('appends ?status= when provided', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, []))

    await listPendingApprovals('unit-1', 'pending')

    expect(apiFetchMock).toHaveBeenCalledWith('/units/unit-1/pending-approvals?status=pending')
  })

  it('returns a failure result on a non-ok response', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(403, { error: 'forbidden' }))

    const result = await listPendingApprovals('unit-1')

    expect(result).toEqual({ ok: false, status: 403, error: 'forbidden', message: undefined })
  })
})

describe('decideTeacherBlockRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('PATCHes /teacher-block-requests/{id} with decision and maps the response', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, { status: 'approved_cancelled', affected_bookings: 2, credits_granted: 3 }),
    )

    const result = await decideTeacherBlockRequest('block-1', 'approve_cancel')

    expect(result).toEqual({
      ok: true,
      status: 'approved_cancelled',
      affectedBookings: 2,
      creditsGranted: 3,
    })
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/teacher-block-requests/block-1',
      expect.objectContaining({ method: 'PATCH' }),
    )
    const [, init] = apiFetchMock.mock.calls[0]
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({ decision: 'approve_cancel', substitute_teacher_id: undefined })
  })

  it('sends substitute_teacher_id for approve_substitute', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, { status: 'approved_substituted', affected_bookings: 1, credits_granted: 0 }),
    )

    await decideTeacherBlockRequest('block-1', 'approve_substitute', 'teacher-2')

    const [, init] = apiFetchMock.mock.calls[0]
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({ decision: 'approve_substitute', substitute_teacher_id: 'teacher-2' })
  })

  it('returns a failure result on a non-ok response', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(409, { error: 'already_decided' }))

    const result = await decideTeacherBlockRequest('block-1', 'reject')

    expect(result).toEqual({ ok: false, status: 409, error: 'already_decided', message: undefined })
  })
})

describe('decideRescheduleCredit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('PATCHes /reschedule-credits/{id} with decision and maps the response', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, { status: 'approved' }))

    const result = await decideRescheduleCredit('credit-1', 'approve')

    expect(result).toEqual({ ok: true, status: 'approved' })
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/reschedule-credits/credit-1',
      expect.objectContaining({ method: 'PATCH' }),
    )
    const [, init] = apiFetchMock.mock.calls[0]
    expect(JSON.parse(init.body as string)).toEqual({ decision: 'approve' })
  })

  it('returns a failure result on a non-ok response', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(403, { error: 'forbidden' }))

    const result = await decideRescheduleCredit('credit-1', 'reject')

    expect(result).toEqual({ ok: false, status: 403, error: 'forbidden', message: undefined })
  })
})
