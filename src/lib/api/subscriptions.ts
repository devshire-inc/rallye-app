// Cliente HTTP de POST /students/{id}/subscriptions (BEAC-1932, story
// BEAC-1927 — "Planos e Assinaturas"), consumido pelo sheet PL3 (BEAC-1936),
// de GET /students/{id}/subscription (BEAC-1972), consumido pela tela PL4
// (BEAC-1937, PL4MySubscriptionPage.tsx), e de POST
// /subscriptions/{id}/change-plan (BEAC-1933), consumido pela tela PL5
// (BEAC-1938, PL5ChangePlanPage.tsx). Mesmo padrão dos demais clientes
// deste pacote (ver ../api/plans.ts): usa apiFetch (não fetch cru), mapeia
// snake_case (wire) <-> camelCase. Contrato (campos de request/response,
// formato de erro) lido DIRETAMENTE do handler real
// (rallye-api/api/internal/subscriptions/handler.go, CreateHandler/
// CreateRequest/SubscriptionResponse/InvoiceResponse, GetHandler/
// SubscriptionDetailResponse) — não inventado a partir da doc do protótipo.
//
// # "Total do período" vem só da resposta desta chamada — não há preview
//
// O AC de BEAC-1936 (#sheet-pl3) pede pra mostrar "Total do período
// calculado conforme a variante escolhida" usando o valor que a API
// devolve, sem recalcular no frontend. BEAC-1932 não expõe nenhum endpoint
// de simulação/dry-run — o único jeito de obter `period_total` é chamando
// esta função de criação de verdade (ver comentário de pacote em
// VincularPlanoSheet.tsx pra como isso molda o fluxo da UI: o total só
// aparece DEPOIS de "Vincular e gerar fatura", numa tela de confirmação).
import { apiFetch } from '../httpClient'
import type { BillingCycle } from './plans'

export type PaymentMethod = 'pix' | 'cartao' | 'dinheiro'

export interface CreateSubscriptionPayload {
  planVariantId: string
  /** ISO 'AAAA-MM-DD'. */
  startDate: string
  paymentMethod: PaymentMethod
  autoRenew: boolean
  generateFirstInvoice: boolean
}

export interface Subscription {
  id: string
  studentId: string
  planVariantId: string
  startDate: string
  endDate: string
  status: string
  paymentMethod: string
  autoRenew: boolean
  creditBalance: number
}

export interface SubscriptionInvoice {
  id: string
  studentId: string
  sourceType: string
  sourceId: string
  description: string
  amount: number
  dueDate: string
  status: string
}

type SubscriptionWire = {
  id: string
  student_id: string
  plan_variant_id: string
  start_date: string
  end_date: string
  status: string
  payment_method: string
  auto_renew: boolean
  credit_balance: number
}

type InvoiceWire = {
  id: string
  student_id: string
  source_type: string
  source_id: string
  description: string
  amount: number
  due_date: string
  status: string
}

function subscriptionFromWire(wire: SubscriptionWire): Subscription {
  return {
    id: wire.id,
    studentId: wire.student_id,
    planVariantId: wire.plan_variant_id,
    startDate: wire.start_date,
    endDate: wire.end_date,
    status: wire.status,
    paymentMethod: wire.payment_method,
    autoRenew: wire.auto_renew,
    creditBalance: wire.credit_balance,
  }
}

function invoiceFromWire(wire: InvoiceWire): SubscriptionInvoice {
  return {
    id: wire.id,
    studentId: wire.student_id,
    sourceType: wire.source_type,
    sourceId: wire.source_id,
    description: wire.description,
    amount: wire.amount,
    dueDate: wire.due_date,
    status: wire.status,
  }
}

export interface ApiFailure {
  ok: false
  status: number
  error: string
  message?: string
  /** Presente só no 409 de POST /students/{id}/subscriptions
   * (`active_subscription_exists`, BEAC-1973/writeActiveSubscriptionExists) —
   * id da assinatura ativa que já existe pro aluno nesta unit. Usado pelo
   * sheet PL3 (BEAC-1974) pra montar uma mensagem de erro específica em vez
   * da genérica, quando o cache local da checagem prévia (GET
   * /students/{id}/subscription) não tiver o nome do plano à mão. */
  subscriptionId?: string
}

async function failureFrom(response: Response): Promise<ApiFailure> {
  const body = await response.json().catch(() => ({}))
  return {
    ok: false,
    status: response.status,
    error: body.error ?? 'unknown_error',
    message: body.message,
    subscriptionId: body.subscription_id,
  }
}

export interface CreateSubscriptionSuccess {
  ok: true
  subscription: Subscription
  periodTotal: number
  invoice: SubscriptionInvoice | null
}

export type CreateSubscriptionResult = CreateSubscriptionSuccess | ApiFailure

/** POST /students/{id}/subscriptions (BEAC-1932, #sheet-pl3 "Vincular e
 * gerar fatura"). `studentId` é o membership do aluno na unit ativa (mesmo
 * `user.id` devolvido por GET /units/{id}/members, ver ../api/members.ts) —
 * o backend resolve a unit pelo contexto de sessão do chamador, não por
 * parâmetro. */
export async function createSubscription(
  studentId: string,
  payload: CreateSubscriptionPayload,
): Promise<CreateSubscriptionResult> {
  const response = await apiFetch(`/students/${encodeURIComponent(studentId)}/subscriptions`, {
    method: 'POST',
    body: JSON.stringify({
      plan_variant_id: payload.planVariantId,
      start_date: payload.startDate,
      payment_method: payload.paymentMethod,
      auto_renew: payload.autoRenew,
      generate_first_invoice: payload.generateFirstInvoice,
    }),
  })

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as {
    subscription: SubscriptionWire
    period_total: number
    invoice: InvoiceWire | null
  }
  return {
    ok: true,
    subscription: subscriptionFromWire(body.subscription),
    periodTotal: body.period_total,
    invoice: body.invoice ? invoiceFromWire(body.invoice) : null,
  }
}

// ---------------------------------------------------------------------------
// GET /students/{id}/subscription (BEAC-1972, PL4/PL5)
// ---------------------------------------------------------------------------

export interface SubscriptionPlanInfo {
  id: string
  name: string
}

export interface SubscriptionVariantInfo {
  id: string
  billingCycle: BillingCycle
  finalPrice: number
}

/** Assinatura ativa de um aluno, com plano/variante embutidos + histórico de
 * faturas — formato de GetHandler (subscriptions/handler.go,
 * SubscriptionDetailResponse). Reaproveita `SubscriptionInvoice` (mesmo
 * shape usado por `createSubscription` acima, mesma tabela
 * public.invoices) para o array `invoices` — PL4 usa esse array
 * diretamente, sem nenhuma segunda chamada de listagem de faturas. */
export interface SubscriptionDetail {
  id: string
  studentId: string
  plan: SubscriptionPlanInfo
  planVariant: SubscriptionVariantInfo
  startDate: string
  endDate: string
  /** Dias restantes até `endDate`, já calculados pelo backend a partir do
   * "hoje" do servidor (clampado a 0) — não recalcular no frontend com o
   * relógio do cliente. */
  remainingDays: number
  status: string
  autoRenew: boolean
  creditBalance: number
  invoices: SubscriptionInvoice[]
}

type SubscriptionDetailWire = {
  id: string
  student_id: string
  plan: SubscriptionPlanInfo
  plan_variant: { id: string; billing_cycle: BillingCycle; final_price: number }
  start_date: string
  end_date: string
  remaining_days: number
  status: string
  auto_renew: boolean
  credit_balance: number
  invoices: InvoiceWire[]
}

export interface GetSubscriptionSuccess {
  ok: true
  subscription: SubscriptionDetail
}

export type GetSubscriptionResult = GetSubscriptionSuccess | ApiFailure

/** GET /students/{id}/subscription (BEAC-1972). `studentId` é o mesmo
 * identificador usado por `createSubscription` acima (membership do aluno /
 * `user.id`, ver GET /me em ../api/me.ts pra descobrir o próprio quando o
 * chamador é o próprio aluno vendo a própria assinatura — caso de uso de
 * PL4). 404 (`subscription_not_found`) é a resposta esperada quando o aluno
 * não tem assinatura ativa — não é um erro inesperado, o chamador
 * (PL4MySubscriptionPage.tsx) trata esse `status === 404` como estado vazio,
 * não como falha genérica. */
export async function getSubscription(studentId: string): Promise<GetSubscriptionResult> {
  const response = await apiFetch(`/students/${encodeURIComponent(studentId)}/subscription`)
  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as SubscriptionDetailWire
  return {
    ok: true,
    subscription: {
      id: body.id,
      studentId: body.student_id,
      plan: { id: body.plan.id, name: body.plan.name },
      planVariant: {
        id: body.plan_variant.id,
        billingCycle: body.plan_variant.billing_cycle,
        finalPrice: body.plan_variant.final_price,
      },
      startDate: body.start_date,
      endDate: body.end_date,
      remainingDays: body.remaining_days,
      status: body.status,
      autoRenew: body.auto_renew,
      creditBalance: body.credit_balance,
      invoices: body.invoices.map(invoiceFromWire),
    },
  }
}

// ---------------------------------------------------------------------------
// POST /subscriptions/{id}/change-plan (BEAC-1933, PL5)
// ---------------------------------------------------------------------------

export interface ChangePlanSuccess {
  ok: true
  subscription: Subscription
  /** Valor de pro-rata calculado pelo backend (ChangePlanHandler/prorate()):
   * positivo = upgrade (diferença cobrada, `invoice` não-nulo), negativo =
   * downgrade (`-proratedAmount` foi somado a `subscription.creditBalance`,
   * `invoice` nulo). Esta é a fonte de verdade pra qualquer valor
   * persistido/cobrado — o cálculo client-side (PL5ChangePlanPage.tsx) é só
   * uma prévia otimista enquanto o aluno navega as opções. */
  proratedAmount: number
  invoice: SubscriptionInvoice | null
}

export type ChangePlanResult = ChangePlanSuccess | ApiFailure

/** POST /subscriptions/{id}/change-plan (BEAC-1933, PL5 "CONFIRMAR TROCA").
 * `subscriptionId` é o id da própria subscription (`SubscriptionDetail.id`,
 * devolvido por `getSubscription` acima) — diferente de `createSubscription`/
 * `getSubscription`, que são escopados por `studentId`. */
export async function changePlan(
  subscriptionId: string,
  newPlanVariantId: string,
): Promise<ChangePlanResult> {
  const response = await apiFetch(
    `/subscriptions/${encodeURIComponent(subscriptionId)}/change-plan`,
    {
      method: 'POST',
      body: JSON.stringify({ new_plan_variant_id: newPlanVariantId }),
    },
  )

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as {
    subscription: SubscriptionWire
    prorated_amount: number
    invoice: InvoiceWire | null
  }
  return {
    ok: true,
    subscription: subscriptionFromWire(body.subscription),
    proratedAmount: body.prorated_amount,
    invoice: body.invoice ? invoiceFromWire(body.invoice) : null,
  }
}
