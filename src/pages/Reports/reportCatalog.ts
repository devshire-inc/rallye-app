import type { ReportType } from '../../lib/api/reports'

/**
 * Catálogo dos 8 relatórios do hub F7 — ícone + rótulo copiados
 * EXATAMENTE da doc F7 (Allye doc a2fc8b3e, seção "Relatórios Disponíveis"
 * / bloco "Layout"). A ordem também é a mesma da doc.
 */
export interface ReportCatalogEntry {
  type: ReportType
  icon: string
  label: string
}

export const REPORT_CATALOG: ReportCatalogEntry[] = [
  { type: 'fluxo-de-caixa', icon: '📊', label: 'Fluxo de Caixa' },
  { type: 'inadimplencia', icon: '📋', label: 'Inadimplência' },
  { type: 'receita-por-esporte', icon: '🏐', label: 'Receita por Esporte' },
  { type: 'receita-por-professor', icon: '👨‍🏫', label: 'Receita por Professor' },
  { type: 'dre', icon: '📈', label: 'DRE Simplificado' },
  { type: 'day-use', icon: '☀️', label: 'Day Use' },
  { type: 'vendas-loja', icon: '🛒', label: 'Vendas da Loja' },
  { type: 'comissoes', icon: '💰', label: 'Comissões' },
]

// Usado por reportCatalog.test.ts para provar que o catálogo cobre
// exatamente os 8 tipos reconhecidos pelo backend (REPORT_TYPES).
export const REPORT_CATALOG_TYPES = REPORT_CATALOG.map((entry) => entry.type)

/**
 * Tipos restritos a Tenant Owner (BEAC-1975): a doc "Financeiro e
 * Pagamentos" (quadro "Relatórios Financeiros → Quem vê") restringe
 * "Receita por Esporte" e "DRE Simplificado" a Tenant Owner — diferente do
 * gate uniforme financeiro:read+relatorios:read que os outros 6 tipos usam
 * (ver rallye-api/api/internal/reports/handler.go,
 * tenantOwnerOnlyReportTypes/IsTenantOwner, mesma lista espelhada aqui).
 */
export const TENANT_OWNER_ONLY_REPORT_TYPES: ReadonlySet<ReportType> = new Set([
  'receita-por-esporte',
  'dre',
])

/**
 * Filtra REPORT_CATALOG pra quem NÃO é Tenant Owner — regra "esconder,
 * nunca desabilitar" (mesmo padrão já usado pelo filtro de unit de Tenant
 * Owner em F1, `F1CashFlowPage.tsx`): os 2 itens restritos simplesmente não
 * aparecem na lista, em vez de aparecerem desabilitados com tooltip.
 * Tenant Owner vê os 8 itens, sem filtragem nenhuma.
 */
export function visibleReportCatalog(isTenantOwner: boolean): ReportCatalogEntry[] {
  if (isTenantOwner) return REPORT_CATALOG
  return REPORT_CATALOG.filter((entry) => !TENANT_OWNER_ONLY_REPORT_TYPES.has(entry.type))
}
