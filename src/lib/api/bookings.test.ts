import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import {
  addBookingParticipant,
  cancelBooking,
  createBooking,
  getBookingsGrid,
  listBookingParticipants,
  submitAttendance,
} from './bookings'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const wireBooking = {
  id: 'booking-1',
  court_id: 'court-1',
  court_name: 'Quadra 1',
  type: 'private',
  start_at: '2026-07-10T09:00:00Z',
  end_at: '2026-07-10T10:00:00Z',
  status: 'confirmed',
  teacher_name: 'Ana Beltrão',
  student_name: 'João',
  unit_id: 'unit-1',
  unit_name: 'Unit Teste',
  checked_in: false,
  student_count: 0,
}

describe('getBookingsGrid', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GETs /units/{id}/bookings with from/to/court_id and maps view_only', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, { bookings: [wireBooking], view_only: true }))

    const result = await getBookingsGrid('unit-1', '2026-07-10T00:00:00Z', '2026-07-11T00:00:00Z', 'court-1')

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/units/unit-1/bookings?from=2026-07-10T00%3A00%3A00Z&to=2026-07-11T00%3A00%3A00Z&court_id=court-1',
    )
    expect(result).toEqual({
      ok: true,
      viewOnly: true,
      bookings: [
        {
          id: 'booking-1',
          courtId: 'court-1',
          courtName: 'Quadra 1',
          type: 'private',
          classId: null,
          className: null,
          startAt: '2026-07-10T09:00:00Z',
          endAt: '2026-07-10T10:00:00Z',
          status: 'confirmed',
          teacherName: 'Ana Beltrão',
          studentName: 'João',
          responsibleName: null,
          reason: null,
          unitId: 'unit-1',
          unitName: 'Unit Teste',
          checkedIn: false,
          studentCount: 0,
        },
      ],
    })
  })

  it('includes student_id in the query string when provided (BEAC-1926 privacy fix)', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, { bookings: [], view_only: false }))

    await getBookingsGrid('unit-1', '2026-07-10T00:00:00Z', '2026-07-11T00:00:00Z', undefined, 'student-9')

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/units/unit-1/bookings?from=2026-07-10T00%3A00%3A00Z&to=2026-07-11T00%3A00%3A00Z&student_id=student-9',
    )
  })

  it('includes teacher_id in the query string when provided (AG4)', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, { bookings: [], view_only: false }))

    await getBookingsGrid('unit-1', '2026-07-10T00:00:00Z', '2026-07-11T00:00:00Z', undefined, undefined, 'teacher-9')

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/units/unit-1/bookings?from=2026-07-10T00%3A00%3A00Z&to=2026-07-11T00%3A00%3A00Z&teacher_id=teacher-9',
    )
  })

  it('returns ok=false on failure without throwing', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(500, { error: 'grid_failed' }))

    const result = await getBookingsGrid('unit-1', 'a', 'b')

    expect(result).toEqual({ ok: false, status: 500, error: 'grid_failed', message: undefined })
  })
})

describe('createBooking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POSTs the snake_case body to /units/{id}/bookings', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(201, wireBooking))

    const result = await createBooking('unit-1', {
      type: 'private',
      courtId: 'court-1',
      startAt: '2026-07-10T09:00:00Z',
      endAt: '2026-07-10T10:00:00Z',
      teacherId: 'teacher-1',
      studentId: 'student-1',
    })

    expect(apiFetchMock).toHaveBeenCalledWith('/units/unit-1/bookings', {
      method: 'POST',
      body: JSON.stringify({
        type: 'private',
        court_id: 'court-1',
        start_at: '2026-07-10T09:00:00Z',
        end_at: '2026-07-10T10:00:00Z',
        teacher_id: 'teacher-1',
        student_id: 'student-1',
        responsible_name: undefined,
        reason: undefined,
      }),
    })
    expect(result.ok).toBe(true)
  })
})

describe('cancelBooking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('PATCHes /bookings/{id} with the cancellation reason', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(200, { ...wireBooking, status: 'cancelled' }))

    const result = await cancelBooking('booking-1', 'Aluno pediu cancelamento')

    expect(apiFetchMock).toHaveBeenCalledWith('/bookings/booking-1', {
      method: 'PATCH',
      body: JSON.stringify({ reason: 'Aluno pediu cancelamento' }),
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.booking.status).toBe('cancelled')
  })

  it('returns ok=false on 409 already_cancelled', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(409, { error: 'already_cancelled' }))

    const result = await cancelBooking('booking-1', 'x')

    expect(result).toEqual({ ok: false, status: 409, error: 'already_cancelled', message: undefined })
  })
})

describe('addBookingParticipant', () => {
  beforeEach(() => vi.clearAllMocks())

  const wireParticipant = {
    id: 'participant-1',
    booking_id: 'booking-1',
    student_id: 'student-1',
    student_name: 'João',
    source: 'manual',
    added_by: 'admin-1',
    added_at: '2026-07-20T10:00:00Z',
    capacity_warning: false,
  }

  it('POSTs /bookings/{id}/participants with the student_id and maps the response', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(201, wireParticipant))

    const result = await addBookingParticipant('booking-1', 'student-1')

    expect(apiFetchMock).toHaveBeenCalledWith('/bookings/booking-1/participants', {
      method: 'POST',
      body: JSON.stringify({ student_id: 'student-1' }),
    })
    expect(result).toEqual({
      ok: true,
      participant: {
        id: 'participant-1',
        bookingId: 'booking-1',
        studentId: 'student-1',
        studentName: 'João',
        source: 'manual',
        addedBy: 'admin-1',
        addedAt: '2026-07-20T10:00:00Z',
        capacityWarning: false,
      },
    })
  })

  it('maps capacity_warning=true (BEAC-1917 AC: avisa, não bloqueia) without treating it as a failure', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(201, { ...wireParticipant, capacity_warning: true }))

    const result = await addBookingParticipant('booking-1', 'student-1')

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.participant.capacityWarning).toBe(true)
  })

  it('returns ok=false on 409 already_participant', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(409, { error: 'already_participant', message: 'aluno já foi adicionado a este booking' }),
    )

    const result = await addBookingParticipant('booking-1', 'student-1')

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: 'already_participant',
      message: 'aluno já foi adicionado a este booking',
    })
  })
})

describe('listBookingParticipants', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GETs /bookings/{id}/participants and maps attendance fields (null until check-in)', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        participants: [
          {
            id: 'participant-1',
            booking_id: 'booking-1',
            student_id: 'student-1',
            student_name: 'Marina Costa',
            source: 'manual',
          },
        ],
      }),
    )

    const result = await listBookingParticipants('booking-1')

    expect(apiFetchMock).toHaveBeenCalledWith('/bookings/booking-1/participants')
    expect(result).toEqual({
      ok: true,
      participants: [
        {
          id: 'participant-1',
          bookingId: 'booking-1',
          studentId: 'student-1',
          studentName: 'Marina Costa',
          source: 'manual',
          attendanceStatus: null,
          checkedInAt: null,
          tier: null,
        },
      ],
    })
  })

  it('maps tier when the student has a skill level registered for the class sport (AG4)', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        participants: [
          {
            id: 'participant-1',
            booking_id: 'booking-1',
            student_id: 'student-1',
            student_name: 'Marina Costa',
            source: 'manual',
            tier: 'b',
          },
        ],
      }),
    )

    const result = await listBookingParticipants('booking-1')

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.participants[0].tier).toBe('b')
  })

  it('maps attendance_status/checked_in_at when already checked in', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        participants: [
          {
            id: 'participant-1',
            booking_id: 'booking-1',
            student_id: 'student-1',
            student_name: 'Marina Costa',
            source: 'manual',
            attendance_status: 'presente',
            checked_in_at: '2026-07-20T18:05:00Z',
          },
        ],
      }),
    )

    const result = await listBookingParticipants('booking-1')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.participants[0].attendanceStatus).toBe('presente')
      expect(result.participants[0].checkedInAt).toBe('2026-07-20T18:05:00Z')
    }
  })

  it('returns ok=false on failure without throwing', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(404, { error: 'booking_not_found' }))

    const result = await listBookingParticipants('booking-1')

    expect(result).toEqual({ ok: false, status: 404, error: 'booking_not_found', message: undefined })
  })
})

describe('submitAttendance', () => {
  beforeEach(() => vi.clearAllMocks())

  it('POSTs /bookings/{id}/attendance with the snake_case batch and maps the response', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        booking_id: 'booking-1',
        retroactive: false,
        results: [
          {
            student_id: 'student-1',
            attendance_status: 'presente',
            checked_in_at: '2026-07-20T18:05:00Z',
          },
        ],
      }),
    )

    const result = await submitAttendance('booking-1', [{ studentId: 'student-1', status: 'presente' }])

    expect(apiFetchMock).toHaveBeenCalledWith('/bookings/booking-1/attendance', {
      method: 'POST',
      body: JSON.stringify({ attendances: [{ student_id: 'student-1', status: 'presente' }] }),
    })
    expect(result).toEqual({
      ok: true,
      bookingId: 'booking-1',
      retroactive: false,
      results: [
        {
          studentId: 'student-1',
          attendanceStatus: 'presente',
          checkedInAt: '2026-07-20T18:05:00Z',
          consecutiveFaltasAlert: false,
        },
      ],
    })
  })

  it('maps retroactive=true (AC: banner de check-in fora do horário)', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        booking_id: 'booking-1',
        retroactive: true,
        results: [{ student_id: 'student-1', attendance_status: 'falta', checked_in_at: '2026-07-20T21:05:00Z' }],
      }),
    )

    const result = await submitAttendance('booking-1', [{ studentId: 'student-1', status: 'falta' }])

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.retroactive).toBe(true)
  })

  it('maps consecutive_faltas_alert when present', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        booking_id: 'booking-1',
        retroactive: false,
        results: [
          {
            student_id: 'student-1',
            attendance_status: 'falta',
            checked_in_at: '2026-07-20T18:05:00Z',
            consecutive_faltas_alert: true,
          },
        ],
      }),
    )

    const result = await submitAttendance('booking-1', [{ studentId: 'student-1', status: 'falta' }])

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.results[0].consecutiveFaltasAlert).toBe(true)
  })

  it('returns ok=false on 403 attendance_edit_locked without throwing', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(403, {
        error: 'attendance_edit_locked',
        message: 'edição de presença bloqueada para Professor após 24h do fim da aula — só Admin pode alterar',
      }),
    )

    const result = await submitAttendance('booking-1', [{ studentId: 'student-1', status: 'presente' }])

    expect(result).toEqual({
      ok: false,
      status: 403,
      error: 'attendance_edit_locked',
      message: 'edição de presença bloqueada para Professor após 24h do fim da aula — só Admin pode alterar',
    })
  })
})
