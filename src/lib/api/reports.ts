/**
 * Cliente HTTP de GET /units/{id}/reports/{type} (BEAC-1967, story BEAC-1714
 * — hub F7) — rallye-api/api/internal/reports/handler.go.
 *
 * A resposta é sempre 200 (nunca um erro HTTP) para os 8 tipos válidos —
 * `available` distingue "relatório com dados reais" de "indisponível"
 * (bloqueado por uma dependência não resolvida) de "vazio por decisão de
 * produto" (ver `reason` nos dois últimos casos).
 *
 * 6 dos 8 tipos têm dados reais nesta dispatch (receita-por-professor +
 * fluxo-de-caixa/inadimplencia/receita-por-esporte/dre/day-use, BEAC-1710
 * já migrada) — cada um com um shape de summary/items PRÓPRIO (backend não
 * força um formato genérico entre tipos, ver comentário de pacote do
 * handler). `Report` carrega os 6 shapes como campos opcionais
 * (`| null`, populado só para o tipo correspondente) em vez de um union
 * discriminado — mais simples de consumir em `ReportDetailPage.tsx`, que já
 * sabe qual tipo está renderizando via `catalogEntry.type`. vendas-loja/
 * comissoes (Épico 9) e qualquer tipo indisponível não populam NENHUM dos 6
 * shapes (todos null).
 */
import { apiFetch } from '../httpClient'

export const REPORT_TYPES = [
  'fluxo-de-caixa',
  'inadimplencia',
  'receita-por-esporte',
  'receita-por-professor',
  'dre',
  'day-use',
  'vendas-loja',
  'comissoes',
] as const

export type ReportType = (typeof REPORT_TYPES)[number]

// ---------------------------------------------------------------------------
// receita-por-professor (formato pré-existente, BEAC-1967 1ª dispatch)
// ---------------------------------------------------------------------------

export interface TeacherRevenueRow {
  teacherId: string
  teacherName: string
  classesCount: number
  amount: number
}

// ---------------------------------------------------------------------------
// fluxo-de-caixa
// ---------------------------------------------------------------------------

export interface CashFlowSummaryData {
  receita: number
  despesas: number
  saldo: number
  recebido: number
  aReceber: number
  emAtraso: number
}

export interface CashFlowCategoryRow {
  sourceType: string
  amount: number
}

export interface CashFlowData {
  summary: CashFlowSummaryData
  categories: CashFlowCategoryRow[]
}

// ---------------------------------------------------------------------------
// inadimplencia
// ---------------------------------------------------------------------------

export interface DelinquencySummaryData {
  totalAmount: number
  studentsCount: number
}

export interface DelinquencyRow {
  studentId: string
  studentName: string
  amount: number
  daysOverdue: number
}

export interface DelinquencyData {
  summary: DelinquencySummaryData
  items: DelinquencyRow[]
}

// ---------------------------------------------------------------------------
// receita-por-esporte
// ---------------------------------------------------------------------------

export interface SportRevenueSummaryData {
  totalAmount: number
}

export interface SportRevenueRow {
  /** null = bucket "Outros" (fatura sem esporte único atribuível — adhoc ou
   * plano multi-esporte, ver comentário de SportRevenueRow no backend). */
  sport: string | null
  amount: number
}

export interface RevenueBySportData {
  summary: SportRevenueSummaryData
  items: SportRevenueRow[]
}

// ---------------------------------------------------------------------------
// dre
// ---------------------------------------------------------------------------

export interface DRESummaryData {
  receita: number
  despesas: number
  resultado: number
}

export interface DRELineRow {
  label: string
  amount: number
}

export interface DREData {
  summary: DRESummaryData
  items: DRELineRow[]
}

// ---------------------------------------------------------------------------
// day-use
// ---------------------------------------------------------------------------

export interface DayUseSummaryData {
  totalBookings: number
  estimatedRevenue: number
}

export interface DayUseRow {
  courtId: string
  courtName: string
  sport: string
  bookingsCount: number
  estimatedRevenue: number
}

export interface DayUseData {
  summary: DayUseSummaryData
  items: DayUseRow[]
}

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

export interface Report {
  type: ReportType
  /** 'AAAA-MM'. */
  period: string
  available: boolean
  /** Motivo de indisponibilidade/vazio — sempre preenchido quando
   * available=false, e também preenchido (sem ser um erro) para
   * vendas-loja/comissoes, que são vazios por decisão de produto. */
  reason: string | null
  /** Só populado para type === 'receita-por-professor'. */
  totalAmount: number | null
  totalClassesCount: number | null
  teacherRevenue: TeacherRevenueRow[]
  /** Populado só quando type === 'fluxo-de-caixa' e available=true. */
  cashFlow: CashFlowData | null
  /** Populado só quando type === 'inadimplencia' e available=true. */
  delinquency: DelinquencyData | null
  /** Populado só quando type === 'receita-por-esporte' e available=true. */
  revenueBySport: RevenueBySportData | null
  /** Populado só quando type === 'dre' e available=true. */
  dre: DREData | null
  /** Populado só quando type === 'day-use' e available=true. */
  dayUse: DayUseData | null
}

type ReportWire = {
  type: string
  period: string
  available: boolean
  reason?: string
  summary?: Record<string, unknown>
  items?: unknown[]
}

function fromWire(wire: ReportWire): Report {
  const base: Report = {
    type: wire.type as ReportType,
    period: wire.period,
    available: wire.available,
    reason: wire.reason ?? null,
    totalAmount: null,
    totalClassesCount: null,
    teacherRevenue: [],
    cashFlow: null,
    delinquency: null,
    revenueBySport: null,
    dre: null,
    dayUse: null,
  }

  if (!wire.available) return base

  switch (wire.type) {
    case 'receita-por-professor': {
      const summary = wire.summary as
        { total_amount?: number; total_classes_count?: number } | undefined
      const items = (wire.items ?? []) as Array<{
        teacher_id: string
        teacher_name: string
        classes_count: number
        amount: number
      }>
      return {
        ...base,
        totalAmount: summary?.total_amount ?? null,
        totalClassesCount: summary?.total_classes_count ?? null,
        teacherRevenue: items.map((item) => ({
          teacherId: item.teacher_id,
          teacherName: item.teacher_name,
          classesCount: item.classes_count,
          amount: item.amount,
        })),
      }
    }
    case 'fluxo-de-caixa': {
      const summary = wire.summary as
        | {
            receita: number
            despesas: number
            saldo: number
            recebido: number
            a_receber: number
            em_atraso: number
          }
        | undefined
      const items = (wire.items ?? []) as Array<{ source_type: string; amount: number }>
      if (!summary) return base
      return {
        ...base,
        cashFlow: {
          summary: {
            receita: summary.receita,
            despesas: summary.despesas,
            saldo: summary.saldo,
            recebido: summary.recebido,
            aReceber: summary.a_receber,
            emAtraso: summary.em_atraso,
          },
          categories: items.map((item) => ({ sourceType: item.source_type, amount: item.amount })),
        },
      }
    }
    case 'inadimplencia': {
      const summary = wire.summary as { total_amount: number; students_count: number } | undefined
      const items = (wire.items ?? []) as Array<{
        student_id: string
        student_name: string
        amount: number
        days_overdue: number
      }>
      if (!summary) return base
      return {
        ...base,
        delinquency: {
          summary: { totalAmount: summary.total_amount, studentsCount: summary.students_count },
          items: items.map((item) => ({
            studentId: item.student_id,
            studentName: item.student_name,
            amount: item.amount,
            daysOverdue: item.days_overdue,
          })),
        },
      }
    }
    case 'receita-por-esporte': {
      const summary = wire.summary as { total_amount: number } | undefined
      const items = (wire.items ?? []) as Array<{ sport: string | null; amount: number }>
      if (!summary) return base
      return {
        ...base,
        revenueBySport: {
          summary: { totalAmount: summary.total_amount },
          items: items.map((item) => ({ sport: item.sport, amount: item.amount })),
        },
      }
    }
    case 'dre': {
      const summary = wire.summary as
        { receita: number; despesas: number; resultado: number } | undefined
      const items = (wire.items ?? []) as Array<{ label: string; amount: number }>
      if (!summary) return base
      return {
        ...base,
        dre: {
          summary: {
            receita: summary.receita,
            despesas: summary.despesas,
            resultado: summary.resultado,
          },
          items: items.map((item) => ({ label: item.label, amount: item.amount })),
        },
      }
    }
    case 'day-use': {
      const summary = wire.summary as
        { total_bookings: number; estimated_revenue: number } | undefined
      const items = (wire.items ?? []) as Array<{
        court_id: string
        court_name: string
        sport: string
        bookings_count: number
        estimated_revenue: number
      }>
      if (!summary) return base
      return {
        ...base,
        dayUse: {
          summary: {
            totalBookings: summary.total_bookings,
            estimatedRevenue: summary.estimated_revenue,
          },
          items: items.map((item) => ({
            courtId: item.court_id,
            courtName: item.court_name,
            sport: item.sport,
            bookingsCount: item.bookings_count,
            estimatedRevenue: item.estimated_revenue,
          })),
        },
      }
    }
    default:
      return base
  }
}

export interface ApiFailure {
  ok: false
  status: number
  error: string
}

async function failureFrom(response: Response): Promise<ApiFailure> {
  const body = await response.json().catch(() => ({}))
  return { ok: false, status: response.status, error: body.error ?? 'unknown_error' }
}

export interface GetReportSuccess {
  ok: true
  report: Report
}

export type GetReportResult = GetReportSuccess | ApiFailure

export interface GetReportFilters {
  /** Só usado por type === 'inadimplencia' — limiar mínimo de dias em
   * atraso (7/15/30/60, ver ReportDetailPage). */
  diasAtraso?: string
  /** Só usado por type === 'day-use'. */
  esporte?: string
}

function reportQuery(period?: string, filters: GetReportFilters = {}): string {
  const params = new URLSearchParams()
  if (period) params.set('period', period)
  if (filters.diasAtraso) params.set('dias_atraso', filters.diasAtraso)
  if (filters.esporte) params.set('esporte', filters.esporte)
  return params.toString() ? `?${params.toString()}` : ''
}

async function requestReport(path: string): Promise<GetReportResult> {
  const response = await apiFetch(path)
  if (!response.ok) return failureFrom(response)
  const body = (await response.json()) as ReportWire
  return { ok: true, report: fromWire(body) }
}

/** GET /units/{unitId}/reports/{type}?period=AAAA-MM (period omitido = mês
 * corrente, mesmo default do backend). */
export async function getReport(
  unitId: string,
  type: ReportType,
  period?: string,
  filters: GetReportFilters = {},
): Promise<GetReportResult> {
  return requestReport(
    `/units/${encodeURIComponent(unitId)}/reports/${encodeURIComponent(type)}${reportQuery(period, filters)}`,
  )
}

/**
 * GET /tenants/{tenantId}/reports/{type}?period=AAAA-MM (BEAC-1969, story
 * BEAC-1715 — "Relatório consolidado de rede"). Mesmo endpoint por-unit
 * acima, só que agregando TODAS as units ativas do tenant — o backend
 * devolve exatamente o mesmo envelope JSON (`ReportWire`, confirmado em
 * rallye-api/api/internal/reports/network.go: mesma struct `Response` do
 * handler por-unit), então reaproveita `fromWire` sem nenhuma adaptação.
 * Tenant-Owner-only no backend (403 pra quem não for).
 *
 * O filtro `?unit_id=` deste endpoint (que restringe a rota de rede a 1
 * unit específica) NÃO é exposto aqui: BEAC-1970 (F1/F7) usa esta função só
 * pro caso "Todas" e continua chamando `getReport` (por-unit) pro caso "uma
 * unit específica" — ver F1CashFlowPage.tsx/ReportDetailPage.tsx. Nenhum
 * consumidor precisa do filtro redundante ainda; adicionar se/quando um
 * caso de uso pedir.
 */
export async function getNetworkReport(
  tenantId: string,
  type: ReportType,
  period?: string,
  filters: GetReportFilters = {},
): Promise<GetReportResult> {
  return requestReport(
    `/tenants/${encodeURIComponent(tenantId)}/reports/${encodeURIComponent(type)}${reportQuery(period, filters)}`,
  )
}
