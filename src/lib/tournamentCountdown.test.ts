import { describe, expect, it } from 'vitest'
import { registrationCountdownLabel } from './tournamentCountdown'

const NOW = new Date('2026-07-23T12:00:00Z')

describe('registrationCountdownLabel', () => {
  it('returns null when there is no registration_closes_at', () => {
    expect(registrationCountdownLabel(null, NOW)).toBeNull()
  })

  it('counts whole days remaining, ignoring time-of-day', () => {
    expect(registrationCountdownLabel('2026-07-28T23:59:59-03:00', NOW)).toBe('encerra em 5 dias')
  })

  it('singularizes "1 dia"', () => {
    expect(registrationCountdownLabel('2026-07-24T23:59:59-03:00', NOW)).toBe('encerra em 1 dia')
  })

  it('shows "encerra hoje" when the deadline is today', () => {
    expect(registrationCountdownLabel('2026-07-23T23:59:59-03:00', NOW)).toBe('encerra hoje')
  })

  it('shows "inscrições encerradas" once the deadline has passed', () => {
    expect(registrationCountdownLabel('2026-07-20T23:59:59-03:00', NOW)).toBe('inscrições encerradas')
  })
})
