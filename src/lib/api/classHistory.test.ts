import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import { listClassHistory } from './classHistory'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('listClassHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GETs /students/{id}/class-history and maps the wire shape (object with class_history key, not a bare array)', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        class_history: [
          {
            enrollment_id: 'enr-1',
            class_id: 'class-1',
            class_name: 'BT intermediária',
            sport: 'beach_tennis',
            rrule: 'FREQ=WEEKLY;BYDAY=TU,TH',
            start_time: '18:00',
            end_time: '19:00',
            teacher_id: 'teacher-1',
            teacher_name: 'Marcus Lima',
            enrolled_at: '2026-06-01T00:00:00Z',
            status: 'active',
          },
          {
            enrollment_id: 'enr-2',
            class_id: 'class-2',
            class_name: 'Padel iniciante',
            sport: 'padel',
            rrule: 'FREQ=WEEKLY;BYDAY=MO',
            start_time: '08:00',
            end_time: '09:00',
            teacher_id: 'teacher-2',
            teacher_name: 'Ana Beltrão',
            enrolled_at: '2026-01-01T00:00:00Z',
            status: 'ended',
          },
        ],
      }),
    )

    const result = await listClassHistory('student-1')

    expect(result).toEqual({
      ok: true,
      classHistory: [
        {
          enrollmentId: 'enr-1',
          classId: 'class-1',
          className: 'BT intermediária',
          sport: 'beach_tennis',
          rrule: 'FREQ=WEEKLY;BYDAY=TU,TH',
          startTime: '18:00',
          endTime: '19:00',
          teacherId: 'teacher-1',
          teacherName: 'Marcus Lima',
          enrolledAt: '2026-06-01T00:00:00Z',
          status: 'active',
        },
        {
          enrollmentId: 'enr-2',
          classId: 'class-2',
          className: 'Padel iniciante',
          sport: 'padel',
          rrule: 'FREQ=WEEKLY;BYDAY=MO',
          startTime: '08:00',
          endTime: '09:00',
          teacherId: 'teacher-2',
          teacherName: 'Ana Beltrão',
          enrolledAt: '2026-01-01T00:00:00Z',
          status: 'ended',
        },
      ],
    })
    expect(apiFetchMock).toHaveBeenCalledWith('/students/student-1/class-history')
  })

  it('maps an empty list', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, { class_history: [] }))

    const result = await listClassHistory('student-1')

    expect(result).toEqual({ ok: true, classHistory: [] })
  })

  it('maps a failure response to ApiFailure (e.g. 403 when staff lacks alunos:read)', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(403, { error: 'forbidden' }))

    const result = await listClassHistory('student-1')

    expect(result).toEqual({ ok: false, status: 403, error: 'forbidden' })
  })
})
