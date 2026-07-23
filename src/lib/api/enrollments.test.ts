import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import { createEnrollment } from './enrollments'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('createEnrollment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('POSTs /classes/{id}/enrollments with { student_id } and maps the response', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(201, {
        id: 'enr-1',
        class_id: 'class-1',
        student_id: 'student-1',
        student_name: 'Marina Costa',
        enrolled_at: '2026-07-23T00:00:00Z',
        status: 'active',
        capacity_warning: false,
      }),
    )

    const result = await createEnrollment('class-1', 'student-1')

    expect(result).toEqual({
      ok: true,
      enrollment: {
        id: 'enr-1',
        classId: 'class-1',
        studentId: 'student-1',
        studentName: 'Marina Costa',
        enrolledAt: '2026-07-23T00:00:00Z',
        status: 'active',
        capacityWarning: false,
      },
    })
    expect(apiFetchMock).toHaveBeenCalledWith('/classes/class-1/enrollments', {
      method: 'POST',
      body: JSON.stringify({ student_id: 'student-1' }),
    })
  })

  it('maps capacity_warning=true without treating it as a failure (warn, not block)', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(201, {
        id: 'enr-2',
        class_id: 'class-1',
        student_id: 'student-2',
        enrolled_at: '2026-07-23T00:00:00Z',
        status: 'active',
        capacity_warning: true,
      }),
    )

    const result = await createEnrollment('class-1', 'student-2')

    expect(result.ok).toBe(true)
    expect(result.ok && result.enrollment.capacityWarning).toBe(true)
    expect(result.ok && result.enrollment.studentName).toBeNull()
  })

  it('maps a 409 already_enrolled response to ApiFailure', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(409, {
        error: 'already_enrolled',
        message: 'aluno já está matriculado nesta turma',
      }),
    )

    const result = await createEnrollment('class-1', 'student-1')

    expect(result).toEqual({ ok: false, status: 409, error: 'already_enrolled' })
  })
})
