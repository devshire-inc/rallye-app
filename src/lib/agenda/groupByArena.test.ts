import { describe, expect, it } from 'vitest'
import type { Booking } from '../api/bookings'
import { groupByArenaLabel } from './groupByArena'

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'b1',
    courtId: 'c1',
    courtName: 'Quadra 2',
    type: 'class_occurrence',
    classId: 'cl1',
    className: 'Beach tennis intermediária',
    startAt: '2026-07-28T14:00:00Z',
    endAt: '2026-07-28T15:00:00Z',
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

describe('groupByArenaLabel', () => {
  it('groups bookings by unitId, carrying the unit name', () => {
    const bookings = [
      booking({ id: 'b1', unitId: 'unit-1', unitName: 'Arena Areia Dourada', startAt: '2026-07-28T16:00:00Z' }),
      booking({ id: 'b2', unitId: 'unit-2', unitName: 'Arena Praia Norte', startAt: '2026-07-28T10:00:00Z' }),
      booking({ id: 'b3', unitId: 'unit-1', unitName: 'Arena Areia Dourada', startAt: '2026-07-28T09:00:00Z' }),
    ]

    const groups = groupByArenaLabel(bookings)

    expect(groups).toEqual([
      {
        unitId: 'unit-1',
        unitName: 'Arena Areia Dourada',
        items: [bookings[2], bookings[0]],
      },
      {
        unitId: 'unit-2',
        unitName: 'Arena Praia Norte',
        items: [bookings[1]],
      },
    ])
  })

  it('sorts groups alphabetically by unit name', () => {
    const bookings = [
      booking({ id: 'b1', unitId: 'unit-z', unitName: 'Zona Sul' }),
      booking({ id: 'b2', unitId: 'unit-a', unitName: 'Arena Areia Dourada' }),
    ]

    const groups = groupByArenaLabel(bookings)

    expect(groups.map((g) => g.unitName)).toEqual(['Arena Areia Dourada', 'Zona Sul'])
  })

  it('returns an empty list for no bookings', () => {
    expect(groupByArenaLabel([])).toEqual([])
  })
})
