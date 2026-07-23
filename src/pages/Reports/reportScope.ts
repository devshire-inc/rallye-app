/**
 * "Todas" (visão consolidada de rede, BEAC-1970) é threadada entre
 * ReportsHubPage e ReportDetailPage via query param `?scope=network` na
 * MESMA rota unit-scoped (`/units/:unitId/reports(/:type)`) — não uma rota
 * `/tenants/:tenantId/reports` nova: as rotas hoje (App.tsx) são todas
 * `/units/:unitId/...`, e trocar pra uma árvore de rotas paralela só pra
 * este 1 caso seria mais invasivo que estender o padrão de query param já
 * usado nesta base (ex.: GetReportFilters em lib/api/reports.ts). O
 * segmento `:unitId` do path continua presente mesmo em modo "Todas" (serve
 * de âncora pro link "‹ Relatórios" e pro card do relatório aberto
 * continuar sabendo qual é a unit "local" caso o usuário volte pra visão
 * por-unit).
 *
 * Módulo próprio (em vez de exportar de ReportsHubPage.tsx) porque
 * ReportDetailPage.tsx também precisa da mesma constante/predicado — nenhum
 * dos dois é "dono" do conceito de scope, e importar de um page file pro
 * outro seria estranho.
 */
export const NETWORK_SCOPE_VALUE = 'network'

/** `true` quando a URL carrega `?scope=network` (visão consolidada). */
export function isNetworkScope(searchParams: URLSearchParams): boolean {
  return searchParams.get('scope') === NETWORK_SCOPE_VALUE
}

/** Query string a anexar numa navegação pra preservar o modo "Todas". */
export function networkScopeQuery(): string {
  return `?scope=${NETWORK_SCOPE_VALUE}`
}
