import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { listInvoices } from '../../lib/api/invoices'
import { listMyMemberships, type MembershipListItem } from '../../lib/api'
import { getNetworkReport } from '../../lib/api/reports'
import { getActiveTenantId } from '../../lib/tenantContext'
import { networkScopeQuery } from '../Reports/reportScope'
import {
  computeCategoryBreakdown,
  computeRecebimentos,
  computeSummary,
  SOURCE_TYPE_LABEL,
} from '../../lib/cashFlowAggregate'
import { formatBRL } from '../../lib/money'
import './Financeiro.css'
import '../../components/AuthLayout/AuthLayout.css'

/** Valor do `<select>` que representa a visão consolidada de rede
 * (BEAC-1970) — nunca colide com um unitId real (UUID). */
const NETWORK_SCOPE_VALUE = 'network'

interface CashFlowSummaryView {
  receita: number
  despesas: number
  saldo: number
}

interface RecebimentosView {
  recebido: number
  aReceber: number
  emAtraso: number
}

/** Linha de "Receita por Categoria" já normalizada pro render — tanto o
 * caminho por-unit (computeCategoryBreakdown, sourceType tipado como
 * InvoiceSourceType) quanto o caminho de rede (categorias de
 * GET /tenants/{id}/reports/fluxo-de-caixa, sourceType como string solta)
 * convergem pra este shape comum, em vez de forçar os dois num tipo só. */
interface BreakdownRow {
  key: string
  label: string
  amount: number
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready'
      summary: CashFlowSummaryView
      recebimentos: RecebimentosView
      breakdown: BreakdownRow[]
      history: { label: string; receita: number }[]
    }

function monthKey(offset: number, from = new Date()): string {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + offset, 1))
  return d.toISOString().slice(0, 7)
}

const MONTH_LABELS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
]

function monthLabel(key: string): string {
  const [, m] = key.split('-')
  return MONTH_LABELS[Number(m) - 1]
}

function emptySummary(): CashFlowSummaryView {
  return { receita: 0, despesas: 0, saldo: 0 }
}

function emptyRecebimentos(): RecebimentosView {
  return { recebido: 0, aReceber: 0, emAtraso: 0 }
}

/**
 * F1 — Fluxo de Caixa (BEAC-1946, story BEAC-1710). Markup segue o doc real
 * "F1 — Fluxo de Caixa" (Allye, ID d63afd25-5489-494f-a4a4-9a5e1cc59735):
 * card de saldo, gráfico dos últimos 3 meses, Recebimentos, Receita por
 * Categoria, Despesas por Categoria, navegação por mês, "VER FATURAS"/
 * "RELATÓRIOS".
 *
 * Visão por-unit: toda a agregação (receita/recebimentos/breakdown) é
 * calculada NO CLIENTE a partir de GET /units/{id}/invoices?month=
 * (BEAC-1943) — ver lib/cashFlowAggregate.ts pras funções puras.
 *
 * GAP CONHECIDO (AC explícito da task, não uma omissão): "Despesas são
 * lançamentos manuais fora de escopo deste épico — gap conhecido, sem tela
 * de lançamento prototipada" — Despesas/"Despesas por Categoria" são
 * sempre R$0,00 com uma nota visível, nunca um valor inventado.
 *
 * "Todas" / visão de rede (BEAC-1970): o seletor de unit (Tenant Owner)
 * ganha uma opção "Todas" além das units do próprio Tenant Owner (listadas
 * via GET /me/memberships, já existente, BEAC-1834 — não fabrica um novo
 * endpoint só pra isso). Quando "Todas" está selecionado, os 3 meses são
 * buscados via GET /tenants/{tenantId}/reports/fluxo-de-caixa?period=
 * (getNetworkReport, BEAC-1969) em vez de agregar invoices por-unit no
 * cliente — o endpoint de rede já devolve summary/recebimentos/categorias
 * agregados do jeito que esta tela precisa (mesmo shape usado por
 * ReportDetailPage.tsx pra 'fluxo-de-caixa'), então não há necessidade de
 * reimplementar a agregação aqui pro caso consolidado. tenantId vem de
 * getActiveTenantId() (tenantContext.ts).
 *
 * Decisão (visão de uma unit específica, escolhida no mesmo seletor):
 * MANTIDA como estava (invoices por-unit + agregação no cliente), não
 * trocada pra GET /units/{id}/reports/fluxo-de-caixa. Razão: o card
 * "Últimos 3 meses" já funciona hoje com uma fonte testada/revisada
 * (BEAC-1946); trocar de fonte só pro caso por-unit não muda nenhum dado
 * visível (mesmo critério de agregação dos dois lados — cashflow.go
 * documenta explicitamente que espelha cashFlowAggregate.ts) e adicionaria
 * risco de regressão sem nenhum ganho — BEAC-1970 só pede a visão
 * consolidada nova, o caso por-unit já estava resolvido.
 */
export default function F1CashFlowPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const [monthOffset, setMonthOffset] = useState(0)
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [memberships, setMemberships] = useState<MembershipListItem[]>([])
  // unitOverride: activeUnitId deriva de unitId (path) por padrão, só
  // divergindo quando o Tenant Owner troca no <select> — inclusive pro
  // sentinel NETWORK_SCOPE_VALUE ("Todas"). Reset ao mudar de rota via o
  // padrão "ajustar state durante o render" (React docs, "Storing
  // information from previous renders") em vez de um useEffect — setState
  // direto no corpo do componente aqui é intencional/seguro (só dispara
  // quando prevUnitId realmente diverge, não um loop), evita o problema de
  // "1 frame com override antigo" que um useEffect teria.
  const [unitOverride, setUnitOverride] = useState<string | null>(null)
  const [prevUnitId, setPrevUnitId] = useState(unitId)
  if (unitId !== prevUnitId) {
    setPrevUnitId(unitId)
    setUnitOverride(null)
  }
  const isNetworkScope = unitOverride === NETWORK_SCOPE_VALUE
  const activeUnitId = isNetworkScope ? undefined : (unitOverride ?? unitId)

  useEffect(() => {
    listMyMemberships()
      .then((list) => setMemberships(list))
      .catch(() => setMemberships([]))
  }, [])

  // isTenantOwner: derivado do `role` literal de cada membership (m.role ===
  // 'Tenant Owner'), NÃO de `memberships.length > 1` — um Tenant Owner
  // recém-criado (POST /tenants) tem exatamente 1 membership (uma tenant,
  // uma unit), então contar memberships esconderia este próprio filtro do
  // Tenant Owner que deveria vê-lo (mesmo bug encontrado e corrigido em
  // ReportsHubPage.tsx, BEAC-1975 — esta tela usava a contagem antiga, era o
  // "benigno" citado lá; corrigido agora que este filtro passa a controlar
  // a visão consolidada de verdade, não só cosmético).
  const isTenantOwner = memberships.some((m) => m.role === 'Tenant Owner')

  const load = useCallback(
    (onCancelled: () => boolean) => {
      const months = [monthOffset - 2, monthOffset - 1, monthOffset].map((o) => monthKey(o))

      if (isNetworkScope) {
        // tenantId ausente (sessão sem memberships persistidas ainda) vira
        // `results = null`, tratado pelo MESMO `.then` abaixo como falha —
        // em vez de um `setState` síncrono aqui no corpo do efeito/callback
        // (violaria react-hooks/set-state-in-effect, já que `load` é
        // chamado direto de dentro de um `useEffect`).
        const tenantId = getActiveTenantId()
        const fetchMonths = tenantId
          ? Promise.all(months.map((m) => getNetworkReport(tenantId, 'fluxo-de-caixa', m)))
          : Promise.resolve(null)

        fetchMonths
          .then((results) => {
            if (onCancelled()) return
            if (!results || results.some((r) => !r.ok)) {
              setState({ status: 'error' })
              return
            }
            const ok = results as Extract<(typeof results)[number], { ok: true }>[]
            const history = months.map((m, idx) => ({
              label: monthLabel(m),
              receita: ok[idx].report.cashFlow?.summary.receita ?? 0,
            }))
            const currentCashFlow = ok[2].report.cashFlow
            setState({
              status: 'ready',
              summary: currentCashFlow
                ? {
                    receita: currentCashFlow.summary.receita,
                    despesas: currentCashFlow.summary.despesas,
                    saldo: currentCashFlow.summary.saldo,
                  }
                : emptySummary(),
              recebimentos: currentCashFlow
                ? {
                    recebido: currentCashFlow.summary.recebido,
                    aReceber: currentCashFlow.summary.aReceber,
                    emAtraso: currentCashFlow.summary.emAtraso,
                  }
                : emptyRecebimentos(),
              breakdown: (currentCashFlow?.categories ?? []).map((c) => ({
                key: c.sourceType,
                label:
                  SOURCE_TYPE_LABEL[c.sourceType as keyof typeof SOURCE_TYPE_LABEL] ?? c.sourceType,
                amount: c.amount,
              })),
              history,
            })
          })
          .catch(() => {
            if (onCancelled()) return
            setState({ status: 'error' })
          })
        return
      }

      if (!activeUnitId) return
      Promise.all(months.map((m) => listInvoices(activeUnitId, { month: m })))
        .then((results) => {
          if (onCancelled()) return
          if (results.some((r) => !r.ok)) {
            setState({ status: 'error' })
            return
          }
          const ok = results as Extract<(typeof results)[number], { ok: true }>[]
          const history = months.map((m, idx) => ({
            label: monthLabel(m),
            receita: computeSummary(ok[idx].invoices).receita,
          }))
          const monthInvoices = ok[2].invoices
          setState({
            status: 'ready',
            summary: computeSummary(monthInvoices),
            recebimentos: computeRecebimentos(monthInvoices),
            breakdown: computeCategoryBreakdown(monthInvoices).map((b) => ({
              key: b.sourceType,
              label: b.label,
              amount: b.amount,
            })),
            history,
          })
        })
        .catch(() => {
          if (onCancelled()) return
          setState({ status: 'error' })
        })
    },
    [activeUnitId, isNetworkScope, monthOffset],
  )

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  const summary = state.status === 'ready' ? state.summary : emptySummary()
  const recebimentos = state.status === 'ready' ? state.recebimentos : emptyRecebimentos()
  const breakdown = state.status === 'ready' ? state.breakdown : []
  const maxCategoryAmount = breakdown.length > 0 ? breakdown[0].amount : 0
  const maxHistory =
    state.status === 'ready' ? Math.max(1, ...state.history.map((h) => h.receita)) : 1

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head">
        <h1>Fluxo de Caixa</h1>
        <div className="spacer" />
        {isTenantOwner ? (
          <div className="unit-filter">
            <select
              aria-label="Filtrar por unit"
              value={isNetworkScope ? NETWORK_SCOPE_VALUE : (activeUnitId ?? '')}
              onChange={(e) => setUnitOverride(e.target.value)}
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
        <div className="month-nav">
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={() => setMonthOffset((o) => o - 1)}
          >
            ◄
          </button>
          <span>{monthKey(monthOffset).split('-').reverse().join('/')}</span>
          <button
            type="button"
            aria-label="Próximo mês"
            onClick={() => setMonthOffset((o) => o + 1)}
          >
            ►
          </button>
        </div>

        {state.status === 'loading' ? <p role="status">Carregando…</p> : null}
        {state.status === 'error' ? (
          <p role="alert">Não foi possível carregar o fluxo de caixa.</p>
        ) : null}

        {state.status === 'ready' ? (
          <>
            <div className="card balance-card">
              <span className="lbl">Receita</span>
              <span className="val success">{formatBRL(summary.receita)}</span>
              <span className="lbl">Despesas</span>
              <span className="val">{formatBRL(summary.despesas)}</span>
              <div className="full">
                <span className="lbl">Saldo</span>
                <span className="val">{formatBRL(summary.saldo)}</span>
              </div>
            </div>

            <div className="card">
              <h2>Últimos 3 meses</h2>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', height: 90 }}>
                {state.history.map((h) => (
                  <div key={h.label} style={{ flex: 1, textAlign: 'center' }}>
                    <div
                      style={{
                        height: `${Math.max(4, (h.receita / maxHistory) * 64)}px`,
                        background: 'var(--data)',
                        borderRadius: 4,
                      }}
                    />
                    <div className="hint" style={{ marginTop: 4 }}>
                      {h.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h2>Recebimentos</h2>
              <div className="recv-row">
                <span>Recebido</span>
                <strong style={{ color: 'var(--success-fg)' }}>
                  {formatBRL(recebimentos.recebido)}
                </strong>
              </div>
              <div className="recv-row">
                <span>A receber</span>
                <strong style={{ color: 'var(--data)' }}>{formatBRL(recebimentos.aReceber)}</strong>
              </div>
              <div
                className="recv-row"
                role="button"
                tabIndex={0}
                onClick={() => activeUnitId && navigate(`/units/${activeUnitId}/invoices`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && activeUnitId) navigate(`/units/${activeUnitId}/invoices`)
                }}
                style={{ cursor: 'pointer' }}
              >
                <span>Em atraso</span>
                <strong style={{ color: 'var(--error-fg)' }}>
                  {formatBRL(recebimentos.emAtraso)}
                </strong>
              </div>
            </div>

            <div className="card">
              <h2>Receita por Categoria</h2>
              {breakdown.length === 0 ? (
                <p className="hint">Nenhum registro financeiro neste mês.</p>
              ) : (
                breakdown.map((b) => (
                  <div className="cat-bar-row" key={b.key}>
                    <span className="lbl">{b.label}</span>
                    <span className="track">
                      <span
                        className="fill"
                        style={{
                          width: `${maxCategoryAmount ? (b.amount / maxCategoryAmount) * 100 : 0}%`,
                        }}
                      />
                    </span>
                    <span className="amt">{formatBRL(b.amount)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="card">
              <h2>Despesas por Categoria</h2>
              <p className="hint">
                Lançamento de despesas está fora do escopo desta versão — nenhuma tela de lançamento
                manual existe ainda (gap conhecido do épico).
              </p>
            </div>

            <div className="actions-row">
              <button
                type="button"
                className="btn btn-primary btn-md"
                onClick={() => activeUnitId && navigate(`/units/${activeUnitId}/invoices`)}
              >
                VER FATURAS
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-md"
                onClick={() => {
                  if (isNetworkScope) {
                    if (unitId) navigate(`/units/${unitId}/reports${networkScopeQuery()}`)
                  } else if (activeUnitId) {
                    navigate(`/units/${activeUnitId}/reports`)
                  }
                }}
              >
                RELATÓRIOS
              </button>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  )
}
