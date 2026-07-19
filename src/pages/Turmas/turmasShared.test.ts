import { describe, expect, it } from 'vitest'
import {
  courtDisplay,
  formatDays,
  formatDaysAndRange,
  formatDaysAndStart,
  levelLabel,
  occupancyOf,
  teacherDisplay,
} from './turmasShared'

describe('formatDays', () => {
  it('joins 2 days with "&", no comma (prototype: "ter & qui")', () => {
    expect(formatDays('FREQ=WEEKLY;BYDAY=TU,TH')).toBe('ter & qui')
  })

  it('joins 3+ days with commas and "&" before the last (prototype: "seg, qua & sex")', () => {
    expect(formatDays('FREQ=WEEKLY;BYDAY=MO,WE,FR')).toBe('seg, qua & sex')
  })

  it('returns a single day without connectors', () => {
    expect(formatDays('FREQ=WEEKLY;BYDAY=SA')).toBe('sáb')
  })

  it('returns empty string when BYDAY is absent', () => {
    expect(formatDays('FREQ=WEEKLY')).toBe('')
  })
})

describe('formatDaysAndStart / formatDaysAndRange', () => {
  it('formats days + start time only (T1 card)', () => {
    expect(formatDaysAndStart('FREQ=WEEKLY;BYDAY=TU,TH', '18:00')).toBe('ter & qui, 18:00')
  })

  it('formats days + full range (T2 header)', () => {
    expect(formatDaysAndRange('FREQ=WEEKLY;BYDAY=TU,TH', '18:00', '19:00')).toBe(
      'ter & qui, 18:00–19:00',
    )
  })

  it('falls back to just the time when there is no BYDAY', () => {
    expect(formatDaysAndStart('FREQ=WEEKLY', '18:00')).toBe('18:00')
  })
})

describe('levelLabel', () => {
  it('capitalizes the first letter', () => {
    expect(levelLabel('intermediário')).toBe('Intermediário')
  })

  it('returns null for null/empty/whitespace', () => {
    expect(levelLabel(null)).toBeNull()
    expect(levelLabel('')).toBeNull()
    expect(levelLabel('   ')).toBeNull()
  })
})

describe('teacherDisplay / courtDisplay', () => {
  it('prefixes a known teacher name with "Prof."', () => {
    expect(teacherDisplay('Marcus Lima')).toBe('Prof. Marcus Lima')
  })

  it('falls back to "Sem professor" when the name is missing/empty', () => {
    expect(teacherDisplay(undefined)).toBe('Sem professor')
    expect(teacherDisplay('')).toBe('Sem professor')
  })

  it('shows the court name as-is, or "—" when missing', () => {
    expect(courtDisplay('Quadra 2')).toBe('Quadra 2')
    expect(courtDisplay(undefined)).toBe('—')
  })
})

describe('occupancyOf', () => {
  it('never claims to know the enrolled count (no class_enrollments backend)', () => {
    const occ = occupancyOf({ capacity: 8 })
    expect(occ.capacity).toBe(8)
    expect(occ.enrolledKnown).toBe(false)
  })
})
