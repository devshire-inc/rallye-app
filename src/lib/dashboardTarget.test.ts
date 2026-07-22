import { describe, expect, it } from 'vitest'
import { dashboardPathForRole } from './dashboardTarget'
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
