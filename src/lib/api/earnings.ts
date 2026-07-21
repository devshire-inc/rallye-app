// Cliente HTTP de GET /teachers/{id}/earnings (BEAC-1699/BEAC-1880) —
// rallye-api/api/internal/earnings/handler.go. Fonte de dados ÚNICA da aba
// Comissão de PR2 (visão Admin) e, futuramente, de PR4 (Meus Ganhos, visão
// do professor) — decisão travada do Épico 5 ("a comissão exibida em PR4
// deve bater exatamente com o que o admin vê em PR2").
//
// Campos lidos diretamente do handler real (`response`, handler.go), não
// adivinhados:
//   - remuneration_model, classes_given_in_period (mês corrente, lido de
//     bookings — não do ledger, que só tem meses fechados)
//   - revenue_generated: só != null quando remuneration_model === 'commission'
//     E houver fonte de receita real (gap do Épico 7 — normalmente null)
//   - pending_amount/paid_amount: soma de commission_records (ledger),
//     TODOS os meses, não só o corrente
//   - current_month_amount: achado desta story (BEAC-1880) — commission_
//     records nunca tem linha pro mês corrente (o cron só fecha o mês
//     ANTERIOR), então isso é calculado em tempo real
//     (commission.Service.EstimatePeriod) pelo backend; null só quando o
//     modelo é 'commission' sem fonte de receita (mesmo gap de
//     revenue_generated)
//   - history: sempre 6 entradas (mais antigo -> mais recente, a última é
//     sempre o mês corrente), cada uma { period: 'AAAA-MM-DD', amount }
import { apiFetch } from '../httpClient'
import type { RemunerationModel } from './teachers'

export interface EarningsHistoryEntry {
  /** 'AAAA-MM-DD' — sempre o dia 1 do mês. */
  period: string
  amount: number
}

export interface Earnings {
  remunerationModel: RemunerationModel
  classesGivenInPeriod: number
  revenueGenerated: number | null
  pendingAmount: number
  paidAmount: number
  currentMonthAmount: number | null
  history: EarningsHistoryEntry[]
}

type EarningsWire = {
  remuneration_model: RemunerationModel
  classes_given_in_period: number
  revenue_generated: number | null
  pending_amount: number
  paid_amount: number
  current_month_amount: number | null
  history: { period: string; amount: number }[]
}

function fromWire(wire: EarningsWire): Earnings {
  return {
    remunerationModel: wire.remuneration_model,
    classesGivenInPeriod: wire.classes_given_in_period,
    revenueGenerated: wire.revenue_generated,
    pendingAmount: wire.pending_amount,
    paidAmount: wire.paid_amount,
    currentMonthAmount: wire.current_month_amount,
    history: wire.history,
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

export interface GetEarningsSuccess {
  ok: true
  earnings: Earnings
}

export type GetEarningsResult = GetEarningsSuccess | ApiFailure

/** GET /teachers/{id}/earnings. */
export async function getEarnings(teacherId: string): Promise<GetEarningsResult> {
  const response = await apiFetch(`/teachers/${encodeURIComponent(teacherId)}/earnings`)

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as EarningsWire
  return { ok: true, earnings: fromWire(body) }
}
