import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { listMyMemberships, type MembershipListItem } from '../../lib/api'
import { visibleReportCatalog } from './reportCatalog'
import { NETWORK_SCOPE_VALUE, isNetworkScope, networkScopeQuery } from './reportScope'
import '../../components/AuthLayout/AuthLayout.css'
import './ReportsPage.css'

/**
 * F7 — hub de Relatórios Financeiros (BEAC-1968, story BEAC-1714). Lista
 * exata de 8 relatórios com ícone, cópia literal da doc F7 (Allye doc
 * a2fc8b3e, bloco "Layout"). Cada item navega para a tela de detalhe
 * (ReportDetailPage) do relatório correspondente.
 *
 * Autorização real ainda é imposta pelo backend (GET /units/{id}/reports/{type}
 * exige financeiro:read E relatorios:read, e mais Tenant Owner para 2 dos 8
 * tipos — ver rallye-api/api/internal/reports/handler.go); um usuário sem
 * acesso aos 6 tipos não restritos ainda recebe o estado de erro/403 ao
 * abrir um relatório específico em ReportDetailPage — mesmo padrão de
 * "backend autoriza, frontend degrada graciosamente" já usado por outras
 * listas desta base (ex.: RolesPage).
 *
 * Gate de Tenant Owner nesta tela (BEAC-1975, corrigido em correction round
 * 1 após review): "Receita por Esporte" e "DRE Simplificado" são restritos a
 * Tenant Owner pela doc "Financeiro e Pagamentos" — regra "esconder, nunca
 * desabilitar". isTenantOwner é derivado do `role` literal retornado por
 * `GET /me/memberships` (`m.role === 'Tenant Owner'`), NÃO de
 * `memberships.length > 1` (padrão usado em F1CashFlowPage.tsx apenas pra
 * mostrar/esconder um filtro de unit, benigno lá) — um Tenant Owner recém
 * criado (`POST /tenants`) tem exatamente 1 membership (uma tenant, uma
 * unit), então contar memberships escondia esses 2 relatórios do próprio
 * Tenant Owner que deveria vê-los. Ver `reportCatalog.visibleReportCatalog`.
 *
 * Multi-unit (Tenant Owner): rota base ainda é `/units/:unitId/reports`
 * (decisão travada da story anterior — nenhuma rota `/tenants/:tenantId/...`
 * nova foi criada), mas BEAC-1970 adiciona um seletor "Todas ▼" no topo,
 * visível só pra Tenant Owner (regra "esconder, nunca desabilitar" — Unit
 * Admin nunca vê este `<select>`, nem desabilitado). "Todas" navega pra
 * MESMA rota com `?scope=network` anexado (ver reportScope.ts) em vez de
 * inventar uma árvore de rotas paralela; escolher uma unit específica do
 * `<select>` navega pra `/units/{outraUnit}/reports` (troca o `:unitId` do
 * path, mesmo padrão de "trocar de unit" já usado pelo filtro de
 * F1CashFlowPage.tsx, só que via navegação de rota em vez de state local —
 * aqui há 2 telas [Hub + Detalhe] que precisam compartilhar a escolha, não
 * 1 só). O clique num card do catálogo propaga o mesmo `scope` pra
 * ReportDetailPage.
 */
export default function ReportsHubPage() {
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [memberships, setMemberships] = useState<MembershipListItem[]>([])

  useEffect(() => {
    listMyMemberships()
      .then((list) => setMemberships(list))
      .catch(() => setMemberships([]))
  }, [])

  const isTenantOwner = memberships.some((m) => m.role === 'Tenant Owner')
  const catalog = visibleReportCatalog(isTenantOwner)
  const networkScope = isNetworkScope(searchParams)
  const scopeQuery = networkScope ? networkScopeQuery() : ''

  return (
    <AppShell orgLabel="Arena Areia Dourada" userLabel="Rafael Andrade · Admin">
      <div className="pg-head">
        <h1>Relatórios</h1>
        <div className="spacer" />
        {isTenantOwner ? (
          <div className="unit-filter">
            <select
              aria-label="Filtrar por unit"
              value={networkScope ? NETWORK_SCOPE_VALUE : (unitId ?? '')}
              onChange={(e) => {
                const next = e.target.value
                if (next === NETWORK_SCOPE_VALUE) {
                  if (unitId) navigate(`/units/${unitId}/reports${networkScopeQuery()}`)
                } else {
                  navigate(`/units/${next}/reports`)
                }
              }}
            >
              <option value={NETWORK_SCOPE_VALUE}>Todas</option>
              {memberships.map((m) => (
                <option key={m.unitId} value={m.unitId}>
                  {m.unit.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className="dash-body">
        <p className="hint">Selecione o relatório:</p>
        <div className="report-hub-list" role="list">
          {catalog.map((entry) => (
            <button
              key={entry.type}
              type="button"
              role="listitem"
              className="report-hub-card"
              onClick={() =>
                unitId && navigate(`/units/${unitId}/reports/${entry.type}${scopeQuery}`)
              }
            >
              <span className="report-hub-card__icon" aria-hidden="true">
                {entry.icon}
              </span>
              <span className="report-hub-card__label">{entry.label}</span>
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
