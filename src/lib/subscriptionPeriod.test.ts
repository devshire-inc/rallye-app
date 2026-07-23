import { describe, expect, it } from 'vitest'
import { formatDateBR, isExpiringSoon, periodProgressPercent } from './subscriptionPeriod'

describe('periodProgressPercent', () => {
  it('a subscription just started (remainingDays == total days) is at 0%', () => {
    // Trimestral: 01/01 a 31/03 -> 90 dias corridos (inclusive).
    expect(periodProgressPercent('2026-01-01', '2026-03-31', 90)).toBe(0)
  })

  it('a subscription on its last day (remainingDays == 1, today still counts as remaining) is at 99%', () => {
    // 89 dos 90 dias já passaram por completo; hoje (o 90º) ainda está em
    // curso, então não bate 100% até remainingDays chegar a 0.
    expect(periodProgressPercent('2026-01-01', '2026-03-31', 1)).toBe(99)
  })

  it('matches the doc example: ~78% of the period elapsed', () => {
    // 90 dias totais, 20 restantes -> 70/90 = 77.7% -> arredonda pra 78%.
    expect(periodProgressPercent('2026-01-01', '2026-03-31', 20)).toBe(78)
  })

  it('clamps to 100 when remainingDays already hit 0 (period over)', () => {
    expect(periodProgressPercent('2026-01-01', '2026-03-31', 0)).toBe(100)
  })

  it('clamps to 0 when remainingDays somehow exceeds the total (defensive)', () => {
    expect(periodProgressPercent('2026-01-01', '2026-03-31', 999)).toBe(0)
  })
})

describe('isExpiringSoon', () => {
  it('true for 1..6 remaining days (doc: "warning se < 7 dias")', () => {
    expect(isExpiringSoon(1)).toBe(true)
    expect(isExpiringSoon(6)).toBe(true)
  })

  it('false for 7+ remaining days', () => {
    expect(isExpiringSoon(7)).toBe(false)
    expect(isExpiringSoon(15)).toBe(false)
  })

  it('false for 0 (already over, not "expiring soon" — a different state)', () => {
    expect(isExpiringSoon(0)).toBe(false)
  })
})

describe('formatDateBR', () => {
  it('formats an ISO date (AAAA-MM-DD) as DD/MM/AAAA', () => {
    expect(formatDateBR('2026-03-31')).toBe('31/03/2026')
  })
})
