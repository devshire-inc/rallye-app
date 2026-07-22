import { describe, expect, it } from 'vitest'
import type { Booking } from '../../lib/api/bookings'
import { bookingsToTeacherAgendaClasses } from './teacherAgendaClasses'

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'booking-1',
    courtId: 'court-1',
    courtName: 'Quadra 3',
    type: 'class_occurrence',
    classId: 'class-1',
    className: 'Padel Avançado',
    startAt: '2026-07-20T18:00:00Z', // segunda-feira
    endAt: '2026-07-20T19:00:00Z',
    status: 'confirmed',
    teacherName: 'Marcus Lima',
    studentName: null,
    responsibleName: null,
    reason: null,
    unitId: 'unit-1',
    unitName: 'Arena Areia Dourada',
    checkedIn: false,
    studentCount: 6,
    ...overrides,
  }
}

describe('bookingsToTeacherAgendaClasses', () => {
  it('groups occurrences by classId into one TeacherAgendaClass', () => {
    const bookings = [
      booking({ id: 'b1', startAt: '2026-07-20T18:00:00Z' }), // segunda
      booking({ id: 'b2', startAt: '2026-07-22T18:00:00Z' }), // quarta
    ]

    const result = bookingsToTeacherAgendaClasses(bookings)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'class-1',
      name: 'Padel Avançado',
      court: 'Quadra 3',
      studentCount: 6,
    })
    expect(result[0].weekdays.sort()).toEqual([1, 3]) // segunda=1, quarta=3
    expect(result[0].daysLabel).toBe('seg/qua')
  })

  it('ignores type=private bookings (no recurring weekday pattern to model)', () => {
    const bookings = [booking({ type: 'private', classId: null, className: null, studentName: 'João' })]

    expect(bookingsToTeacherAgendaClasses(bookings)).toEqual([])
  })

  it('keeps separate classes as separate entries', () => {
    const bookings = [
      booking({ id: 'b1', classId: 'class-1', className: 'Padel Avançado' }),
      booking({ id: 'b2', classId: 'class-2', className: 'Beach Tennis Iniciante', courtName: 'Quadra 1' }),
    ]

    const result = bookingsToTeacherAgendaClasses(bookings)

    expect(result.map((c) => c.id).sort()).toEqual(['class-1', 'class-2'])
  })

  it('returns an empty array when there are no class_occurrence bookings', () => {
    expect(bookingsToTeacherAgendaClasses([])).toEqual([])
  })
})
