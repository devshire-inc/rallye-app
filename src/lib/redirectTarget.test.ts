import { describe, expect, it } from 'vitest'
import { DASHBOARD_PATH, S1_PATH, redirectPathForMemberships } from './redirectTarget'

describe('redirectPathForMemberships', () => {
  it('goes to S1 when there are 2 or more memberships', () => {
    expect(redirectPathForMemberships(['a', 'b'])).toBe(S1_PATH)
    expect(redirectPathForMemberships(['a', 'b', 'c'])).toBe(S1_PATH)
  })

  it('goes straight to the dashboard when there is exactly 1 membership', () => {
    expect(redirectPathForMemberships(['a'])).toBe(DASHBOARD_PATH)
  })

  it('goes to the dashboard when there are no memberships (fallback)', () => {
    expect(redirectPathForMemberships([])).toBe(DASHBOARD_PATH)
  })
})
