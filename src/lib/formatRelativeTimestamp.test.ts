import { describe, expect, it } from 'vitest'
import { formatRelativeTimestamp } from './formatRelativeTimestamp'

describe('formatRelativeTimestamp', () => {
  const now = new Date(2026, 6, 16, 20, 0, 0) // 16 de julho de 2026, 20:00 local

  it('formats a timestamp from today as "hoje, HH:MM"', () => {
    const iso = new Date(2026, 6, 16, 9, 14, 0).toISOString()

    expect(formatRelativeTimestamp(iso, now)).toBe('hoje, 09:14')
  })

  it('formats a timestamp from yesterday as "ontem, HH:MM"', () => {
    const iso = new Date(2026, 6, 15, 16, 40, 0).toISOString()

    expect(formatRelativeTimestamp(iso, now)).toBe('ontem, 16:40')
  })

  it('formats an older timestamp as "D de mês, HH:MM" (no leading zero on day, no year)', () => {
    const iso = new Date(2026, 6, 3, 11, 2, 0).toISOString()

    expect(formatRelativeTimestamp(iso, now)).toBe('3 de julho, 11:02')
  })

  it('formats an older timestamp from a different month correctly', () => {
    const iso = new Date(2026, 0, 5, 8, 0, 0).toISOString()

    expect(formatRelativeTimestamp(iso, now)).toBe('5 de janeiro, 08:00')
  })

  it('does not treat "yesterday" across a month boundary incorrectly', () => {
    const firstOfMonth = new Date(2026, 7, 1, 10, 0, 0) // 1 de agosto
    const iso = new Date(2026, 6, 31, 23, 30, 0).toISOString() // 31 de julho

    expect(formatRelativeTimestamp(iso, firstOfMonth)).toBe('ontem, 23:30')
  })
})
