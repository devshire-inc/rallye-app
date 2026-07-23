import { describe, expect, it } from 'vitest'
import { REPORT_TYPES } from '../../lib/api/reports'
import {
  REPORT_CATALOG,
  REPORT_CATALOG_TYPES,
  TENANT_OWNER_ONLY_REPORT_TYPES,
  visibleReportCatalog,
} from './reportCatalog'

describe('REPORT_CATALOG', () => {
  it('has exactly 8 entries, matching REPORT_TYPES 1:1 (same set, same order)', () => {
    expect(REPORT_CATALOG).toHaveLength(8)
    expect(REPORT_CATALOG_TYPES).toEqual([...REPORT_TYPES])
  })

  it('every entry has a non-empty icon and label', () => {
    for (const entry of REPORT_CATALOG) {
      expect(entry.icon.length).toBeGreaterThan(0)
      expect(entry.label.length).toBeGreaterThan(0)
    }
  })

  it('matches the exact copy of the F7 doc list', () => {
    const wantLabels = [
      'Fluxo de Caixa',
      'Inadimplência',
      'Receita por Esporte',
      'Receita por Professor',
      'DRE Simplificado',
      'Day Use',
      'Vendas da Loja',
      'Comissões',
    ]
    expect(REPORT_CATALOG.map((e) => e.label)).toEqual(wantLabels)
  })
})

describe('TENANT_OWNER_ONLY_REPORT_TYPES', () => {
  it('contains exactly receita-por-esporte and dre (doc Financeiro e Pagamentos)', () => {
    expect(TENANT_OWNER_ONLY_REPORT_TYPES.size).toBe(2)
    expect(TENANT_OWNER_ONLY_REPORT_TYPES.has('receita-por-esporte')).toBe(true)
    expect(TENANT_OWNER_ONLY_REPORT_TYPES.has('dre')).toBe(true)
  })
})

describe('visibleReportCatalog', () => {
  it('Tenant Owner (isTenantOwner=true) sees all 8 entries', () => {
    expect(visibleReportCatalog(true)).toEqual(REPORT_CATALOG)
  })

  it('non-Tenant-Owner (isTenantOwner=false) does not see Receita por Esporte or DRE Simplificado', () => {
    const visible = visibleReportCatalog(false)
    expect(visible).toHaveLength(6)
    expect(visible.map((e) => e.type)).not.toContain('receita-por-esporte')
    expect(visible.map((e) => e.type)).not.toContain('dre')
  })

  it('non-Tenant-Owner still sees the other 6 reports, in the same order (no regression)', () => {
    const visible = visibleReportCatalog(false)
    const wantTypes = REPORT_CATALOG_TYPES.filter((t) => t !== 'receita-por-esporte' && t !== 'dre')
    expect(visible.map((e) => e.type)).toEqual(wantTypes)
  })
})
