import { beforeEach, describe, expect, it } from 'vitest'
import { appendCreatedUnit, loadUnits } from './unitsLocalStore'

describe('unitsLocalStore', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('returns a seed unit (labeled as such) when nothing was persisted yet', () => {
    const units = loadUnits('tenant-a')
    expect(units).toHaveLength(1)
    expect(units[0].isSeed).toBe(true)
  })

  it('appends a real created unit on top of the seed, not replacing it', () => {
    appendCreatedUnit('tenant-a', { id: 'unit-1', name: 'Unidade Sul' })

    const units = loadUnits('tenant-a')
    expect(units).toHaveLength(2)
    expect(units[0].isSeed).toBe(true)
    expect(units[1]).toEqual({ id: 'unit-1', name: 'Unidade Sul', isSeed: false })
  })

  it('keeps units scoped per tenantId (no cross-tenant leakage)', () => {
    appendCreatedUnit('tenant-a', { id: 'unit-1', name: 'Unidade A' })

    const unitsB = loadUnits('tenant-b')
    expect(unitsB).toHaveLength(1)
    expect(unitsB[0].isSeed).toBe(true)
  })

  it('appends multiple created units in order', () => {
    appendCreatedUnit('tenant-a', { id: 'unit-1', name: 'Unidade 1' })
    appendCreatedUnit('tenant-a', { id: 'unit-2', name: 'Unidade 2' })

    const units = loadUnits('tenant-a')
    expect(units.map((u) => u.id)).toEqual(['seed-tenant-a', 'unit-1', 'unit-2'])
  })
})
