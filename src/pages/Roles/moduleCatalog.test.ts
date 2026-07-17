import { describe, expect, it } from 'vitest'
import { MODULE_CATALOG, permissionSummary } from './moduleCatalog'

describe('MODULE_CATALOG', () => {
  it('has exactly the 9 modules referenced by the toast copy (BEAC-1842 seed matrix)', () => {
    expect(MODULE_CATALOG.map((m) => m.slug)).toEqual([
      'alunos',
      'professores',
      'agenda',
      'financeiro',
      'torneios',
      'loja',
      'config',
      'relatorios',
      'quadras',
    ])
  })
})

describe('permissionSummary', () => {
  it('returns a neutral copy when there are no permissions at all', () => {
    expect(permissionSummary({})).toBe('nenhum módulo liberado')
  })

  it('renders read as "ver" and write as the module-specific verb, joined by "/"', () => {
    expect(permissionSummary({ alunos: ['read', 'write'] })).toBe(
      'alunos: ver/gerenciar · 1 módulo',
    )
  })

  it('renders a read-only module with just "ver"', () => {
    expect(permissionSummary({ agenda: ['read'] })).toBe('agenda: ver · 1 módulo')
  })

  it('joins multiple modules with " · " and appends the module count', () => {
    expect(
      permissionSummary({
        alunos: ['read', 'write'],
        agenda: ['read', 'write'],
        loja: ['read'],
      }),
    ).toBe('alunos: ver/gerenciar · agenda: ver/agendar · loja: ver · 3 módulos')
  })

  it('ignores modules with an empty action list (treats them as not granted)', () => {
    expect(permissionSummary({ alunos: [], agenda: ['read'] })).toBe('agenda: ver · 1 módulo')
  })
})
