import { describe, expect, it } from 'vitest'
import { dashboardPathForRole } from './dashboardTarget'
import { DASHBOARD_PATH } from './redirectTarget'

describe('dashboardPathForRole', () => {
  it('stubs every role to the generic dashboard until D1/D2/D3/OW1 exist', () => {
    expect(dashboardPathForRole('Admin')).toBe(DASHBOARD_PATH)
    expect(dashboardPathForRole('Professor')).toBe(DASHBOARD_PATH)
    expect(dashboardPathForRole('Aluno')).toBe(DASHBOARD_PATH)
    expect(dashboardPathForRole(null)).toBe(DASHBOARD_PATH)
  })
})
