import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { Input } from '../../components/ui/Input/Input'
import { Select } from '../../components/ui/Select/Select'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import {
  getNetworkReport,
  getReport,
  type GetReportResult,
  type Report,
  type ReportType,
} from '../../lib/api/reports'
import { getActiveTenantId } from '../../lib/tenantContext'
import { formatBRL } from '../../lib/money'
import { SOURCE_TYPE_LABEL } from '../../lib/cashFlowAggregate'
import { sportLabel, SPORTS } from '../../lib/sports'
import { REPORT_CATALOG } from './reportCatalog'
import { isNetworkScope, networkScopeQuery } from './reportScope'
import '../../components/AuthLayout/AuthLayout.css'
import './ReportsPage.css'

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; report: Report }

function currentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/**
 * F7 — detalhe de 1 relatório (BEAC-1968, story BEAC-1714). Filtros no
 * topo (período sempre; dias de atraso só em Inadimplência; esporte só em
 * Day Use — cópia exata da doc F7, "Filtros"), gráfico e tabela de dados
 * abaixo (AC).
 *
 * Consome GET /units/{unitId}/reports/{type} (BEAC-1967). 6 dos 8 tipos têm
 * dados reais (receita-por-professor + fluxo-de-caixa/inadimplencia/
 * receita-por-esporte/dre/day-use, todos desbloqueados por BEAC-1710) — cada
 * um com seu próprio gráfico+tabela (ver render* abaixo, 1 por shape de
 * `Report`). Os 2 restantes (vendas-loja/comissoes, Épico 9) e qualquer
 * tipo indisponível (`available=false`) caem no fallback genérico
 * (banner + "sem dados"), sem inventar dado.
 *
 * Inadimplência: o filtro de dias de atraso e o botão "ENVIAR LEMBRETE EM
 * MASSA" (cópia exata do exemplo da doc F7) são renderizados SEMPRE (AC),
 * mas o botão fica desabilitado com `title` explicativo — mesma convenção
 * já usada nesta base para uma ação genuinamente indisponível por falta de
 * IMPLEMENTAÇÃO (não de dado, já que a lista de inadimplentes agora é
 * real): enviar lembrete em massa é uma ação própria, fora do escopo desta
 * dispatch (só os relatórios/leitura foram implementados).
 *
 * Exportação (PDF/CSV): fora de escopo (AC), mostrado como botão
 * desabilitado com `title` "pós-MVP".
 *
 * "Todas" / visão de rede (BEAC-1970): quando a URL carrega `?scope=network`
 * (ver reportScope.ts — setado pelo seletor "Todas ▼" de ReportsHubPage),
 * este componente chama GET /tenants/{tenantId}/reports/{type}
 * (getNetworkReport, BEAC-1969) em vez de GET /units/{unitId}/reports/{type}
 * — MESMO envelope de resposta (Report), então nenhum dos render* abaixo
 * precisa saber a diferença. tenantId vem de getActiveTenantId()
 * (tenantContext.ts, já derivado das memberships da sessão) — não de
 * `:unitId`, que continua no path só como âncora do link "‹ Relatórios" e
 * pra permitir voltar a um scope por-unit.
 *
 * BEAC-2112 (restyle Claude Design): os 3 filtros (Período/Dias de
 * atraso/Esporte) passaram a usar ui/Input e ui/Select (mesmo padrão de
 * ReportsHubPage.tsx/F1CashFlowPage.tsx) — o nome acessível de cada campo
 * (`getByLabelText`) não muda, só a associação passou de `aria-label` solto
 * pra `<label htmlFor>` real. Os botões "Exportar (PDF/CSV)" e "ENVIAR
 * LEMBRETE EM MASSA" continuam `.btn` cru: precisam do atributo `title`
 * (tooltip explicativo do estado desabilitado), que ui/Button não expõe.
 */
export default function ReportDetailPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId, type } = useParams<{ unitId: string; type: string }>()
  const [searchParams] = useSearchParams()
  const networkScope = isNetworkScope(searchParams)
  const catalogEntry = REPORT_CATALOG.find((entry) => entry.type === type)

  const [period, setPeriod] = useState(currentPeriod)
  const [daysOverdue, setDaysOverdue] = useState('7')
  const [esporte, setEsporte] = useState('')
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    if (!catalogEntry) return
    let cancelled = false

    // scopedId: tenantId em modo "Todas", unitId no modo por-unit (default).
    // fetchReport aponta pra getNetworkReport/getReport — MESMA assinatura
    // nos dois (id, type, period?, filters?), então o resto do efeito (as 3
    // formas de chamada logo abaixo) não precisa se repetir por scope.
    const scopedId = networkScope ? getActiveTenantId() : unitId
    const fetchReport = networkScope ? getNetworkReport : getReport

    // Sem setState({status:'loading'}) síncrono aqui (dispararia um render
    // em cascata, ver react-hooks/set-state-in-effect) — mesmo padrão já
    // usado por TeachersListPage/TeacherEarningsPage: o estado inicial
    // 'loading' do useState cobre a primeira carga; refetches por troca de
    // filtro (período/dias de atraso/esporte) trocam direto para
    // 'ready'/'error' quando a promise resolve, sem piscar 'loading' de novo.
    //
    // scopedId ausente: unitId ausente é impossível dado o path desta rota
    // (edge case só teórico); tenantId ausente É plausível (sessão sem
    // memberships persistidas ainda). Os dois casos viram uma ApiFailure
    // sintética que passa pelo MESMO `.then` abaixo (em vez de um
    // `setState` síncrono dentro do efeito, que violaria
    // react-hooks/set-state-in-effect) — mesmo resultado visível ("Não foi
    // possível carregar"), sem duplicar o tratamento de erro.
    //
    // 3 chamadas distintas (não 1 chamada com filters?: undefined) — cada
    // ramo passa EXATAMENTE os argumentos que aquele tipo usa, em vez de
    // sempre passar um 4º argumento (mesmo quando vazio): mantém a mesma
    // assinatura observável de antes desta dispatch para os tipos que não
    // têm filtro específico (receita-por-professor e os demais).
    const resultPromise: Promise<GetReportResult> = !scopedId
      ? Promise.resolve({ ok: false, status: 0, error: 'missing_scope_id' })
      : catalogEntry.type === 'inadimplencia'
        ? fetchReport(scopedId, catalogEntry.type, period, { diasAtraso: daysOverdue })
        : catalogEntry.type === 'day-use' && esporte
          ? fetchReport(scopedId, catalogEntry.type, period, { esporte })
          : fetchReport(scopedId, catalogEntry.type, period)

    resultPromise.then((result) => {
      if (cancelled) return
      if (!result.ok) {
        setState({ status: 'error' })
        return
      }
      setState({ status: 'ready', report: result.report })
    })

    return () => {
      cancelled = true
    }
  }, [unitId, catalogEntry, period, daysOverdue, esporte, networkScope])

  if (!catalogEntry) {
    return (
      <AppShell orgLabel={orgLabel} userLabel={userLabel}>
        <div className="pg-head">
          <Link
            className="back"
            to={
              unitId
                ? `/units/${unitId}/reports${networkScope ? networkScopeQuery() : ''}`
                : '/dashboard'
            }
          >
            ‹ Relatórios
          </Link>
        </div>
        <p role="alert">Relatório desconhecido.</p>
      </AppShell>
    )
  }

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head">
        <Link
          className="back"
          to={
            unitId
              ? `/units/${unitId}/reports${networkScope ? networkScopeQuery() : ''}`
              : '/dashboard'
          }
        >
          ‹ Relatórios
        </Link>
        <h1>
          {catalogEntry.icon} {catalogEntry.label}
        </h1>
        <div className="spacer" />
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled
          title="Exportação (PDF/CSV) é pós-MVP — fora de escopo desta story."
        >
          Exportar (PDF/CSV)
        </button>
      </div>

      <div className="dash-body">
        <div className="report-filters">
          <Input
            id="report-period"
            label="Período"
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />

          {catalogEntry.type === 'inadimplencia' ? (
            <Select
              id="report-days-overdue"
              label="Dias de atraso"
              value={daysOverdue}
              onChange={(e) => setDaysOverdue(e.target.value)}
              options={[
                { value: '7', label: '7+ dias' },
                { value: '15', label: '15+ dias' },
                { value: '30', label: '30+ dias' },
                { value: '60', label: '60+ dias' },
              ]}
            />
          ) : null}

          {catalogEntry.type === 'day-use' ? (
            <Select
              id="report-esporte"
              label="Esporte"
              value={esporte}
              onChange={(e) => setEsporte(e.target.value)}
              options={[
                { value: '', label: 'Todos' },
                ...SPORTS.map((sport) => ({ value: sport.slug, label: sport.label })),
              ]}
            />
          ) : null}
        </div>

        {state.status === 'loading' ? <p role="status">Carregando relatório…</p> : null}
        {state.status === 'error' ? (
          <p role="alert">Não foi possível carregar este relatório.</p>
        ) : null}

        {state.status === 'ready' ? (
          <ReportBody report={state.report} reportType={catalogEntry.type} />
        ) : null}
      </div>
    </AppShell>
  )
}

/** Item genérico de gráfico de barras — usado pelos 5 relatórios
 * desbloqueados por BEAC-1710. Só `aria-label` carrega o rótulo+valor por
 * extenso (a tabela logo abaixo já mostra o texto visível "de verdade";
 * duplicar como `<span>` visível aqui faria o mesmo texto aparecer 2x no
 * DOM). */
interface BarItem {
  key: string
  ariaLabel: string
  value: number
}

function Bars({ items, emptyHint }: { items: BarItem[]; emptyHint: string }) {
  if (items.length === 0) {
    return <p className="hint">{emptyHint}</p>
  }
  const maxValue = Math.max(1, ...items.map((item) => Math.abs(item.value)))
  return (
    <div className="mini-bars">
      {items.map((item) => (
        <div
          key={item.key}
          className="bar"
          style={{ height: `${Math.max(4, (Math.abs(item.value) / maxValue) * 120)}px` }}
          aria-label={item.ariaLabel}
        />
      ))}
    </div>
  )
}

function ReportBody({ report, reportType }: { report: Report; reportType: ReportType }) {
  return (
    <>
      {!report.available ? (
        <div className="report-banner report-banner--unavailable" role="status">
          <strong>Indisponível.</strong> {report.reason}
        </div>
      ) : null}

      {report.available && !hasAnyData(report) && report.reason ? (
        <div className="report-banner report-banner--empty" role="status">
          {report.reason}
        </div>
      ) : null}

      <ReportContent report={report} reportType={reportType} />

      {reportType === 'inadimplencia' ? (
        <button
          type="button"
          className="btn btn-primary btn-full"
          disabled
          title="Envio em massa de lembretes ainda não implementado — fora do escopo desta dispatch."
        >
          ENVIAR LEMBRETE EM MASSA
        </button>
      ) : null}
    </>
  )
}

/** true quando QUALQUER um dos shapes tipados (ou teacherRevenue) tem pelo
 * menos 1 linha — usado só para decidir se o banner "vazio" (reason sem ser
 * erro, ex.: vendas-loja/comissoes) deve aparecer. */
function hasAnyData(report: Report): boolean {
  return (
    report.teacherRevenue.length > 0 ||
    (report.cashFlow?.categories.length ?? 0) > 0 ||
    (report.delinquency?.items.length ?? 0) > 0 ||
    (report.revenueBySport?.items.length ?? 0) > 0 ||
    (report.dre?.items.length ?? 0) > 0 ||
    (report.dayUse?.items.length ?? 0) > 0
  )
}

function ReportContent({ report, reportType }: { report: Report; reportType: ReportType }) {
  switch (reportType) {
    case 'fluxo-de-caixa':
      if (report.cashFlow) return <CashFlowSection data={report.cashFlow} />
      break
    case 'inadimplencia':
      if (report.delinquency) return <DelinquencySection data={report.delinquency} />
      break
    case 'receita-por-esporte':
      if (report.revenueBySport) return <RevenueBySportSection data={report.revenueBySport} />
      break
    case 'dre':
      if (report.dre) return <DRESection data={report.dre} />
      break
    case 'day-use':
      if (report.dayUse) return <DayUseSection data={report.dayUse} />
      break
    case 'receita-por-professor':
      return <TeacherRevenueSection report={report} />
  }

  return <FallbackSection report={report} />
}

function Section({
  chart,
  table,
  tableHeading = 'Dados',
}: {
  chart: ReactNode
  table: ReactNode
  tableHeading?: string
}) {
  return (
    <>
      <div className="chart-wrap">
        <div className="sec-head">
          <h2>Gráfico</h2>
        </div>
        {chart}
      </div>
      <div>
        <div className="sec-head">
          <h2>{tableHeading}</h2>
        </div>
        {table}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// fluxo-de-caixa
// ---------------------------------------------------------------------------

function CashFlowSection({ data }: { data: NonNullable<Report['cashFlow']> }) {
  const { summary, categories } = data
  return (
    <>
      <div className="report-summary-cards">
        <SummaryCard label="Receita" value={summary.receita} tone="positive" />
        <SummaryCard label="Despesas" value={summary.despesas} tone="negative" />
        <SummaryCard label="Saldo" value={summary.saldo} tone="neutral" />
        <SummaryCard label="Recebido" value={summary.recebido} tone="positive" />
        <SummaryCard label="A receber" value={summary.aReceber} tone="neutral" />
        <SummaryCard label="Em atraso" value={summary.emAtraso} tone="negative" />
      </div>
      <Section
        tableHeading="Receita por Categoria"
        chart={
          <Bars
            items={categories.map((c) => ({
              key: c.sourceType,
              ariaLabel: `${SOURCE_TYPE_LABEL[c.sourceType as keyof typeof SOURCE_TYPE_LABEL] ?? c.sourceType}: ${formatBRL(c.amount)}`,
              value: c.amount,
            }))}
            emptyHint="Sem dados para este período."
          />
        }
        table={
          categories.length === 0 ? (
            <p className="hint">Nenhum dado para este período.</p>
          ) : (
            <table className="report-table">
              <thead>
                <tr>
                  <th>Categoria</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.sourceType}>
                    <td>
                      {SOURCE_TYPE_LABEL[c.sourceType as keyof typeof SOURCE_TYPE_LABEL] ??
                        c.sourceType}
                    </td>
                    <td>{formatBRL(c.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      />
    </>
  )
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'positive' | 'negative' | 'neutral'
}) {
  return (
    <div className={`report-summary-card report-summary-card--${tone}`}>
      <span className="report-summary-card__label">{label}</span>
      <span className="report-summary-card__value">{formatBRL(value)}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// inadimplencia
// ---------------------------------------------------------------------------

function DelinquencySection({ data }: { data: NonNullable<Report['delinquency']> }) {
  const { summary, items } = data
  return (
    <>
      <div className="report-summary-cards">
        <SummaryCard label="Total em atraso" value={summary.totalAmount} tone="negative" />
        <div className="report-summary-card report-summary-card--neutral">
          <span className="report-summary-card__label">Alunos inadimplentes</span>
          <span className="report-summary-card__value">{summary.studentsCount}</span>
        </div>
      </div>
      <Section
        chart={
          <Bars
            items={items.map((row) => ({
              key: row.studentId,
              ariaLabel: `${row.studentName}: ${formatBRL(row.amount)}, ${row.daysOverdue} dias`,
              value: row.amount,
            }))}
            emptyHint="Nenhum aluno inadimplente."
          />
        }
        table={
          items.length === 0 ? (
            <p className="hint">Nenhum aluno inadimplente.</p>
          ) : (
            <table className="report-table">
              <thead>
                <tr>
                  <th>Aluno</th>
                  <th>Valor</th>
                  <th>Dias em atraso</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.studentId}>
                    <td>{row.studentName}</td>
                    <td>{formatBRL(row.amount)}</td>
                    <td>{row.daysOverdue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// receita-por-esporte
// ---------------------------------------------------------------------------

function sportBucketLabel(sport: string | null): string {
  return sport ? sportLabel(sport) : 'Outros'
}

function RevenueBySportSection({ data }: { data: NonNullable<Report['revenueBySport']> }) {
  const { summary, items } = data
  return (
    <>
      <div className="report-summary-cards">
        <SummaryCard label="Receita total" value={summary.totalAmount} tone="positive" />
      </div>
      <Section
        table={
          items.length === 0 ? (
            <p className="hint">Nenhum dado para este período.</p>
          ) : (
            <table className="report-table">
              <thead>
                <tr>
                  <th>Esporte</th>
                  <th>Receita</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.sport ?? 'outros'}>
                    <td>{sportBucketLabel(row.sport)}</td>
                    <td>{formatBRL(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
        chart={
          <Bars
            items={items.map((row) => ({
              key: row.sport ?? 'outros',
              ariaLabel: `${sportBucketLabel(row.sport)}: ${formatBRL(row.amount)}`,
              value: row.amount,
            }))}
            emptyHint="Sem dados para este período."
          />
        }
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// dre
// ---------------------------------------------------------------------------

function DRESection({ data }: { data: NonNullable<Report['dre']> }) {
  const { items } = data
  return (
    <Section
      tableHeading="DRE Simplificado"
      chart={
        <Bars
          items={items.map((row) => ({
            key: row.label,
            ariaLabel: `${row.label}: ${formatBRL(row.amount)}`,
            value: row.amount,
          }))}
          emptyHint="Sem dados para este período."
        />
      }
      table={
        <table className="report-table">
          <thead>
            <tr>
              <th>Linha</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>{formatBRL(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    />
  )
}

// ---------------------------------------------------------------------------
// day-use
// ---------------------------------------------------------------------------

function DayUseSection({ data }: { data: NonNullable<Report['dayUse']> }) {
  const { summary, items } = data
  return (
    <>
      <div className="report-summary-cards">
        <div className="report-summary-card report-summary-card--neutral">
          <span className="report-summary-card__label">Reservas confirmadas</span>
          <span className="report-summary-card__value">{summary.totalBookings}</span>
        </div>
        <SummaryCard label="Receita estimada" value={summary.estimatedRevenue} tone="positive" />
      </div>
      <Section
        tableHeading="Por Quadra"
        chart={
          <Bars
            items={items.map((row) => ({
              key: row.courtId,
              ariaLabel: `${row.courtName}: ${row.bookingsCount} reservas, ${formatBRL(row.estimatedRevenue)}`,
              value: row.estimatedRevenue,
            }))}
            emptyHint="Sem reservas de Day Use neste período."
          />
        }
        table={
          items.length === 0 ? (
            <p className="hint">Sem reservas de Day Use neste período.</p>
          ) : (
            <table className="report-table">
              <thead>
                <tr>
                  <th>Quadra</th>
                  <th>Reservas</th>
                  <th>Receita estimada</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.courtId}>
                    <td>{row.courtName}</td>
                    <td>{row.bookingsCount}</td>
                    <td>{formatBRL(row.estimatedRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        }
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// receita-por-professor (formato pré-existente, BEAC-1967 1ª dispatch —
// gráfico/tabela mantidos exatamente como já implementados/revisados)
// ---------------------------------------------------------------------------

function TeacherRevenueSection({ report }: { report: Report }) {
  if (report.teacherRevenue.length === 0) {
    return (
      <Section
        chart={
          <p className="hint">
            {report.available ? 'Sem dados para este período.' : 'Gráfico indisponível.'}
          </p>
        }
        table={
          <p className="hint">
            {report.available ? 'Nenhum dado para este período.' : 'Tabela indisponível.'}
          </p>
        }
      />
    )
  }

  const maxAmount = Math.max(1, ...report.teacherRevenue.map((row) => row.amount))
  return (
    <Section
      chart={
        <div className="mini-bars">
          {report.teacherRevenue.map((row) => (
            <div key={row.teacherId} className="mb">
              <div
                className="bar"
                style={{ height: `${Math.max(4, (row.amount / maxAmount) * 120)}px` }}
                aria-label={`${row.teacherName}: ${formatBRL(row.amount)}`}
              />
              <span>{row.teacherName}</span>
            </div>
          ))}
        </div>
      }
      table={
        <table className="report-table">
          <thead>
            <tr>
              <th>Professor</th>
              <th>Aulas</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {report.teacherRevenue.map((row) => (
              <tr key={row.teacherId}>
                <td>{row.teacherName}</td>
                <td>{row.classesCount}</td>
                <td>{formatBRL(row.amount)}</td>
              </tr>
            ))}
          </tbody>
          {report.totalAmount !== null ? (
            <tfoot>
              <tr>
                <td>Total</td>
                <td>{report.totalClassesCount}</td>
                <td>{formatBRL(report.totalAmount)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      }
    />
  )
}

// ---------------------------------------------------------------------------
// Fallback — vendas-loja/comissoes (Épico 9) e qualquer tipo indisponível.
// ---------------------------------------------------------------------------

function FallbackSection({ report }: { report: Report }) {
  return (
    <Section
      chart={
        <p className="hint">
          {report.available ? 'Sem dados para este período.' : 'Gráfico indisponível.'}
        </p>
      }
      table={
        <p className="hint">
          {report.available ? 'Nenhum dado para este período.' : 'Tabela indisponível.'}
        </p>
      }
    />
  )
}
