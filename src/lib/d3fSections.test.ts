import { describe, expect, it } from 'vitest'
import { visibleD3FSections, type D3FModuleAccess } from './d3fSections'

function access(overrides: Partial<D3FModuleAccess> = {}): D3FModuleAccess {
  return {
    professores: false,
    agenda: false,
    financeiro: false,
    torneios: false,
    config: false,
    relatorios: false,
    ...overrides,
  }
}

describe('visibleD3FSections', () => {
  it('returns exactly 1 section when only 1 module is granted', () => {
    const sections = visibleD3FSections(access({ agenda: true }), 'unit-1')

    expect(sections).toEqual([{ module: 'agenda', label: 'Agenda', path: '/units/unit-1/agenda' }])
  })

  it('returns exactly the 3 granted sections, no more no less', () => {
    const sections = visibleD3FSections(
      access({ agenda: true, financeiro: true, relatorios: true }),
      'unit-1',
    )

    expect(sections.map((s) => s.module)).toEqual(['agenda', 'financeiro', 'relatorios'])
  })

  it('returns an empty array when no module is granted', () => {
    expect(visibleD3FSections(access(), 'unit-1')).toEqual([])
  })

  it('resolves the exact real route per module', () => {
    const sections = visibleD3FSections(
      access({
        professores: true,
        agenda: true,
        financeiro: true,
        torneios: true,
        config: true,
        relatorios: true,
      }),
      'unit-9',
    )

    expect(sections).toEqual([
      { module: 'agenda', label: 'Agenda', path: '/units/unit-9/agenda' },
      { module: 'professores', label: 'Professores', path: '/units/unit-9/teachers' },
      { module: 'financeiro', label: 'Financeiro', path: '/units/unit-9/cashflow' },
      { module: 'torneios', label: 'Torneios', path: '/units/unit-9/tournaments' },
      { module: 'relatorios', label: 'Relatórios', path: '/units/unit-9/reports' },
      { module: 'config', label: 'Config', path: '/units/unit-9/settings' },
    ])
  })
})
