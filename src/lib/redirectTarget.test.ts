import { describe, expect, it } from 'vitest'
import { S1_PATH, redirectPathForMemberships } from './redirectTarget'
import type { Membership } from './tenantContext'

function membership(unitId: string, tenantId = 'tenant-1'): Membership {
  return { unit_id: unitId, tenant_id: tenantId }
}

describe('redirectPathForMemberships', () => {
  it('goes to S1 when there are 2 or more memberships', () => {
    expect(redirectPathForMemberships([membership('a'), membership('b')])).toBe(S1_PATH)
    expect(redirectPathForMemberships([membership('a'), membership('b'), membership('c')])).toBe(
      S1_PATH,
    )
  })

  it('goes straight to the unit-scoped dashboard when there is exactly 1 membership', () => {
    expect(redirectPathForMemberships([membership('a')])).toBe('/units/a/dashboard')
  })

  it('goes to S1 when there are no memberships (empty-state lives there)', () => {
    expect(redirectPathForMemberships([])).toBe(S1_PATH)
  })
})
