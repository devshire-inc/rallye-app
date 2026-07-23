// Cliente HTTP de public.invoices (BEAC-1939, story BEAC-1710 — "Modelo
// unificado de fatura") — rallye-api/api/internal/invoices. Mesmo padrão de
// src/lib/api/teachers.ts: usa apiFetch, não fetch cru; tipos wire (snake_case)
// convertidos pra camelCase na borda.
//
// GET /units/{id}/invoices é usado tanto por F2 (Lista de Faturas, Admin)
// quanto por F5 (Minhas Faturas, Aluno) — o próprio endpoint decide o que
// devolver conforme a permission do chamador (financeiro:read -> todas as
// faturas da unit; sem essa permission -> só as próprias, AC "aluno vê
// apenas as próprias faturas"), então o cliente é o mesmo pros dois casos.
import { apiFetch } from '../httpClient'

export type InvoiceSourceType = 'subscription' | 'adhoc' | 'store_order' | 'tournament_entry'
export type InvoiceStatus = 'gerada' | 'enviada' | 'paga' | 'atrasada' | 'cancelada' | 'estornada'

export interface ApiFailure {
  ok: false
  status: number
  error: string
}

async function failureFrom(response: Response): Promise<ApiFailure> {
  const body = await response.json().catch(() => ({}))
  return { ok: false, status: response.status, error: body.error ?? 'unknown_error' }
}

// ---------------------------------------------------------------------------
// GET /units/{id}/invoices — listagem (BEAC-1943/F2, BEAC-1950/F5)
// ---------------------------------------------------------------------------

export interface InvoiceListItem {
  id: string
  studentId: string
  studentName: string
  sourceType: InvoiceSourceType
  description: string
  amount: number
  dueDate: string
  status: InvoiceStatus
  daysOverdue: number | null
  paymentMethod: string | null
  paidAt: string | null
}

type InvoiceListItemWire = {
  id: string
  student_id: string
  student_name: string
  source_type: InvoiceSourceType
  description: string
  amount: number
  due_date: string
  status: InvoiceStatus
  days_overdue: number | null
  payment_method: string | null
  paid_at: string | null
}

function fromListWire(wire: InvoiceListItemWire): InvoiceListItem {
  return {
    id: wire.id,
    studentId: wire.student_id,
    studentName: wire.student_name,
    sourceType: wire.source_type,
    description: wire.description,
    amount: wire.amount,
    dueDate: wire.due_date,
    status: wire.status,
    daysOverdue: wire.days_overdue,
    paymentMethod: wire.payment_method,
    paidAt: wire.paid_at,
  }
}

export interface ListInvoicesSuccess {
  ok: true
  invoices: InvoiceListItem[]
  total: number
}

export type ListInvoicesResult = ListInvoicesSuccess | ApiFailure

export interface ListInvoicesFilters {
  status?: InvoiceStatus
  /** Formato AAAA-MM. */
  month?: string
}

/** GET /units/{id}/invoices?status=&month= — ordenação (atrasadas primeiro,
 * pendentes por vencimento, pagas por último) e total já vêm calculados
 * pelo backend (AC de BEAC-1943). */
export async function listInvoices(
  unitId: string,
  filters: ListInvoicesFilters = {},
): Promise<ListInvoicesResult> {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.month) params.set('month', filters.month)
  const query = params.toString() ? `?${params.toString()}` : ''

  const response = await apiFetch(`/units/${encodeURIComponent(unitId)}/invoices${query}`)
  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as { invoices: InvoiceListItemWire[]; total: number }
  return { ok: true, invoices: body.invoices.map(fromListWire), total: body.total }
}

// ---------------------------------------------------------------------------
// GET /invoices/{id} — detalhe + timeline (BEAC-1944/F3)
// ---------------------------------------------------------------------------

export interface InvoiceEvent {
  eventType: string
  metadata: string | null
  createdAt: string
}

type InvoiceEventWire = { event_type: string; metadata: string | null; created_at: string }

export interface InvoiceDetail {
  id: string
  studentId: string
  studentName: string
  sourceType: InvoiceSourceType
  description: string
  amount: number
  dueDate: string
  status: InvoiceStatus
  paymentLink: string | null
  paymentMethod: string | null
  paidAt: string | null
  createdAt: string
  events: InvoiceEvent[]
}

type InvoiceDetailWire = {
  id: string
  student_id: string
  student_name: string
  source_type: InvoiceSourceType
  description: string
  amount: number
  due_date: string
  status: InvoiceStatus
  payment_link: string | null
  payment_method: string | null
  paid_at: string | null
  created_at: string
  events: InvoiceEventWire[]
}

function fromDetailWire(wire: InvoiceDetailWire): InvoiceDetail {
  return {
    id: wire.id,
    studentId: wire.student_id,
    studentName: wire.student_name,
    sourceType: wire.source_type,
    description: wire.description,
    amount: wire.amount,
    dueDate: wire.due_date,
    status: wire.status,
    paymentLink: wire.payment_link,
    paymentMethod: wire.payment_method,
    paidAt: wire.paid_at,
    createdAt: wire.created_at,
    events: wire.events.map((e) => ({
      eventType: e.event_type,
      metadata: e.metadata,
      createdAt: e.created_at,
    })),
  }
}

export interface GetInvoiceSuccess {
  ok: true
  invoice: InvoiceDetail
}

export type GetInvoiceResult = GetInvoiceSuccess | ApiFailure

/** GET /invoices/{id} — próprio aluno sempre pode ver a própria fatura;
 * qualquer outro chamador precisa de financeiro:read (senão 403, AC de
 * BEAC-1944). */
export async function getInvoice(invoiceId: string): Promise<GetInvoiceResult> {
  const response = await apiFetch(`/invoices/${encodeURIComponent(invoiceId)}`)
  if (!response.ok) return failureFrom(response)
  const body = (await response.json()) as InvoiceDetailWire
  return { ok: true, invoice: fromDetailWire(body) }
}

// ---------------------------------------------------------------------------
// POST /units/{id}/invoices — criar cobrança avulsa (BEAC-1942/F4)
// ---------------------------------------------------------------------------

/** Tipo escolhido no F4 — usado só pra pré-preencher Descrição/Valor no
 * FRONTEND (ver F4CreateInvoicePage); o backend sempre grava
 * source_type='adhoc' independente do que for enviado aqui. */
export type CreateInvoiceType = 'mensalidade' | 'pacote' | 'torneio' | 'avulso'

export interface CreateInvoicePayload {
  studentId: string
  type: CreateInvoiceType
  description: string
  amount: number
  dueDate: string
  generateLink: boolean
  sendWhatsApp: boolean
  sendEmail: boolean
}

export interface CreateInvoiceSuccess {
  ok: true
  invoiceId: string
}

export interface CreateInvoiceFailure {
  ok: false
  status: number
  error: string
  message?: string
}

export type CreateInvoiceResult = CreateInvoiceSuccess | CreateInvoiceFailure

/** POST /units/{id}/invoices — AC: due_date no passado é rejeitada
 * (400 invalid_body); tipo "Avulso" permite qualquer valor/descrição. */
export async function createInvoice(
  unitId: string,
  payload: CreateInvoicePayload,
): Promise<CreateInvoiceResult> {
  const response = await apiFetch(`/units/${encodeURIComponent(unitId)}/invoices`, {
    method: 'POST',
    body: JSON.stringify({
      student_id: payload.studentId,
      type: payload.type,
      description: payload.description,
      amount: payload.amount,
      due_date: payload.dueDate,
      generate_link: payload.generateLink,
      send_whatsapp: payload.sendWhatsApp,
      send_email: payload.sendEmail,
    }),
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: body.error ?? 'unknown_error',
      message: body.message,
    }
  }
  return { ok: true, invoiceId: body.id }
}

// ---------------------------------------------------------------------------
// POST /invoices/{id}/manual-payment e /cancel (BEAC-1945/F3 ações admin)
// ---------------------------------------------------------------------------

export interface StatusActionSuccess {
  ok: true
  status: InvoiceStatus
}

export type StatusActionResult = StatusActionSuccess | ApiFailure

/** POST /invoices/{id}/manual-payment — AC: rejeitado (409) se a fatura já
 * está paga/cancelada/estornada. */
export async function registerManualPayment(
  invoiceId: string,
  paymentMethod: string,
): Promise<StatusActionResult> {
  const response = await apiFetch(`/invoices/${encodeURIComponent(invoiceId)}/manual-payment`, {
    method: 'POST',
    body: JSON.stringify({ payment_method: paymentMethod }),
  })
  if (!response.ok) return failureFrom(response)
  const body = (await response.json()) as { status: InvoiceStatus }
  return { ok: true, status: body.status }
}

/** POST /invoices/{id}/cancel — AC: só disponível se status é
 * gerada/enviada/atrasada (409 senão); notifica o aluno. */
export async function cancelInvoice(invoiceId: string): Promise<StatusActionResult> {
  const response = await apiFetch(`/invoices/${encodeURIComponent(invoiceId)}/cancel`, {
    method: 'POST',
  })
  if (!response.ok) return failureFrom(response)
  const body = (await response.json()) as { status: InvoiceStatus }
  return { ok: true, status: body.status }
}

// ---------------------------------------------------------------------------
// POST /invoices/{id}/refund (BEAC-1951/BEAC-1711/F3 — sheet "Estornar")
// ---------------------------------------------------------------------------

export type RefundType = 'total' | 'parcial'

export interface RefundInvoiceSuccess {
  ok: true
  status: InvoiceStatus
  amount: number
}

export interface RefundInvoiceFailure {
  ok: false
  status: number
  error: string
  message?: string
}

export type RefundInvoiceResult = RefundInvoiceSuccess | RefundInvoiceFailure

/** POST /invoices/{id}/refund — AC: type=total sempre marca status=estornada
 * (cancela por completo); type=parcial mantém status=paga e ajusta o valor.
 * amount só é enviado (e exigido pelo backend) quando type=parcial. AC:
 * bloqueado (409) se a fatura foi paga há mais de 7 dias, ou se o chamador
 * não tem permission financeiro:write (403, mesmo com financeiro:read). */
export async function refundInvoice(
  invoiceId: string,
  type: RefundType,
  amount?: number,
): Promise<RefundInvoiceResult> {
  const response = await apiFetch(`/invoices/${encodeURIComponent(invoiceId)}/refund`, {
    method: 'POST',
    body: JSON.stringify(type === 'parcial' ? { type, amount } : { type }),
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: body.error ?? 'unknown_error',
      message: body.message,
    }
  }
  return { ok: true, status: body.status, amount: body.amount }
}
