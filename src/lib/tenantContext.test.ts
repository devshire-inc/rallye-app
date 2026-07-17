import { beforeEach, describe, expect, it } from 'vitest'
import {
  getActiveTenantId,
  getActiveUnitId,
  setActiveTenantId,
  setSessionMemberships,
} from './tenantContext'

describe('tenantContext', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('getActiveTenantId: returns null when there is no session data yet', () => {
    expect(getActiveTenantId()).toBeNull()
  })

  it('getActiveTenantId: derives the tenant id from real session memberships (Tenant Owner, single membership)', () => {
    setSessionMemberships([{ unit_id: 'unit-1', tenant_id: 'tenant-1' }])

    expect(getActiveTenantId()).toBe('tenant-1')
  })

  it('getActiveTenantId: derives from the first membership when there are several', () => {
    setSessionMemberships([
      { unit_id: 'unit-1', tenant_id: 'tenant-1' },
      { unit_id: 'unit-2', tenant_id: 'tenant-2' },
    ])

    expect(getActiveTenantId()).toBe('tenant-1')
  })

  it('getActiveTenantId: returns null when the session has no memberships', () => {
    setSessionMemberships([])

    expect(getActiveTenantId()).toBeNull()
  })

  it('setActiveTenantId: manual override takes precedence over derived memberships', () => {
    setSessionMemberships([{ unit_id: 'unit-1', tenant_id: 'tenant-1' }])
    setActiveTenantId('tenant-manual')

    expect(getActiveTenantId()).toBe('tenant-manual')
  })

  it('getActiveUnitId: returns null when there is no session data yet', () => {
    expect(getActiveUnitId()).toBeNull()
  })

  it('getActiveUnitId: derives the unit id from the first real session membership', () => {
    setSessionMemberships([
      { unit_id: 'unit-1', tenant_id: 'tenant-1' },
      { unit_id: 'unit-2', tenant_id: 'tenant-2' },
    ])

    expect(getActiveUnitId()).toBe('unit-1')
  })

  it('getActiveUnitId: returns null when the session has no memberships', () => {
    setSessionMemberships([])

    expect(getActiveUnitId()).toBeNull()
  })
})
