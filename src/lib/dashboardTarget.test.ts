import { describe, expect, it } from 'vitest'
import { dashboardPathForRole, resolveDashboardVariant } from './dashboardTarget'
import { DASHBOARD_PATH } from './redirectTarget'

describe('dashboardPathForRole', () => {
  it('routes to the unit-scoped dashboard when a unitId is given, regardless of role', () => {
    expect(dashboardPathForRole('Admin', 'unit-1')).toBe('/units/unit-1/dashboard')
    expect(dashboardPathForRole('Professor', 'unit-1')).toBe('/units/unit-1/dashboard')
    expect(dashboardPathForRole('Aluno', 'unit-1')).toBe('/units/unit-1/dashboard')
    expect(dashboardPathForRole(null, 'unit-1')).toBe('/units/unit-1/dashboard')
  })

  it('falls back to the generic dashboard when no unitId is given', () => {
    expect(dashboardPathForRole('Admin', null)).toBe(DASHBOARD_PATH)
  })
})

describe('resolveDashboardVariant', () => {
  it('returns GENERIC when role is null', () => {
    expect(resolveDashboardVariant(null)).toBe('GENERIC')
  })

  it('returns D1 for Aluno', () => {
    expect(resolveDashboardVariant('Aluno')).toBe('D1')
  })

  it('returns D2 for Professor', () => {
    expect(resolveDashboardVariant('Professor')).toBe('D2')
  })

  it('returns D3 for Unit Admin and Platform Admin', () => {
    expect(resolveDashboardVariant('Unit Admin')).toBe('D3')
    expect(resolveDashboardVariant('Platform Admin')).toBe('D3')
  })

  it('returns OW1 for Tenant Owner', () => {
    expect(resolveDashboardVariant('Tenant Owner')).toBe('OW1')
  })

  it('returns D3F for any other non-null role (custom role)', () => {
    expect(resolveDashboardVariant('Recepção')).toBe('D3F')
  })
})
