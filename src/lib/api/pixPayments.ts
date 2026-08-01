// Cliente HTTP da cobrança PIX de uma fatura — POST /invoices/{id}/payments/pix
// (emite/reaproveita) e GET /payments/{id} (consulta, usada como polling pela
// tela "13 · Pagamento PIX", ../../pages/Financeiro/PixPaymentPage.tsx).
//
// Mesmo padrão de ./classOccurrences.ts: usa apiFetch (nunca fetch cru), tipos
// wire em snake_case convertidos pra camelCase na borda, falha como
// `ApiFailure` com status/error/message.
//
// AVISO DE PRODUTO — o provider é `mock` e o `qr_code` que o backend devolve é
// DELIBERADAMENTE IMPAGÁVEL: não é um BR Code EMV válido, nenhum app de banco
// consegue lê-lo, e não existe gateway integrado. Nada neste módulo (nem na
// tela que o consome) deve tratar essa string como um código PIX real —
// existe `mock: true` na resposta justamente para a UI poder ser honesta a
// respeito. Ver `isMockProvider` no fim do arquivo.
//
// Também NÃO existe endpoint que o próprio aluno possa chamar para confirmar
// o pagamento: a confirmação mockada exige permission financeiro:write e só
// existe com uma env ligada no backend. Ou seja, a cobrança nasce `pending` e
// SÓ sai desse estado se um admin registrar o pagamento (ou se expirar). É por
// isso que a tela faz polling em vez de oferecer um "já paguei".
import { apiFetch } from '../httpClient'
import type { InvoiceStatus } from './invoices'

export interface ApiFailure {
  ok: false
  status: number
  error: string
  message?: string
}

/**
 * Status da cobrança. `pending` e `expired` são os dois valores que o backend
 * documenta hoje; os demais estão aqui porque a confirmação administrativa
 * existe do outro lado e o nome exato do estado terminal de sucesso não é
 * garantido pelo contrato.
 *
 * Justamente por isso NENHUMA decisão de UI deve comparar contra um literal de
 * sucesso — use `isPixConfirmed`/`isPixPending`/`isPixExpired` abaixo, que
 * classificam por `confirmedAt`/`invoiceStatus` (dados estáveis) em vez de
 * apostar no literal.
 */
export type PixPaymentStatus = 'pending' | 'confirmed' | 'paid' | 'expired' | 'failed' | 'canceled'

export interface PixPayment {
  paymentId: string
  invoiceId: string
  status: PixPaymentStatus
  /** Reais (mesma unidade de InvoiceDetail.amount), não centavos. */
  amount: number
  method: string
  /** `mock` enquanto não houver gateway — ver `isMockProvider`. */
  provider: string
  /** `true` quando a cobrança não é pagável de verdade. */
  mock: boolean
  /** String impagável no provider `mock`. NUNCA renderizar como QR Code. */
  qrCode: string
  /** ISO/RFC3339 — a cobrança expira 30 min após a emissão. */
  expiresAt: string | null
  createdAt: string
  /** ISO/RFC3339 quando um admin registrou o pagamento; null enquanto pending. */
  confirmedAt: string | null
  /** Status da FATURA, devolvido junto de propósito para o polling da tela
   * precisar de uma chamada só (sem um GET /invoices/{id} em paralelo). */
  invoiceStatus: InvoiceStatus
}

type PixPaymentWire = {
  payment_id: string
  invoice_id: string
  status: PixPaymentStatus
  amount: number
  method: string
  provider: string
  mock: boolean
  qr_code: string
  expires_at: string | null
  created_at: string
  confirmed_at: string | null
  invoice_status: InvoiceStatus
}

function fromWire(wire: PixPaymentWire): PixPayment {
  return {
    paymentId: wire.payment_id,
    invoiceId: wire.invoice_id,
    status: wire.status,
    amount: wire.amount,
    method: wire.method,
    provider: wire.provider,
    mock: wire.mock,
    qrCode: wire.qr_code,
    expiresAt: wire.expires_at ?? null,
    createdAt: wire.created_at,
    confirmedAt: wire.confirmed_at ?? null,
    invoiceStatus: wire.invoice_status,
  }
}

export interface PixPaymentSuccess {
  ok: true
  payment: PixPayment
}

export type PixPaymentResult = PixPaymentSuccess | ApiFailure

async function readResult(response: Response): Promise<PixPaymentResult> {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: body.error ?? 'unknown_error',
      message: body.message,
    }
  }
  return { ok: true, payment: fromWire(body as PixPaymentWire) }
}

/**
 * POST /invoices/{id}/payments/pix — emite a cobrança. Sem corpo.
 *
 * Idempotente na prática: 201 quando cria uma cobrança nova, 200 quando
 * reaproveita a `pending` que já existia para a fatura. Os dois casos chegam
 * aqui como o mesmo sucesso — a tela não precisa distinguir, e é por isso que
 * ela pode chamar este endpoint direto na montagem sem medo de gerar cobranças
 * duplicadas a cada refresh.
 *
 * Erros: 403 `forbidden` (não é a fatura do chamador), 404 `invoice_not_found`,
 * 409 `invoice_not_payable` (fatura já paga/cancelada/estornada).
 */
export async function createPixCharge(invoiceId: string): Promise<PixPaymentResult> {
  const response = await apiFetch(`/invoices/${encodeURIComponent(invoiceId)}/payments/pix`, {
    method: 'POST',
  })
  return readResult(response)
}

/**
 * GET /payments/{id} — mesmo shape do POST; é a chamada de polling.
 *
 * Uma `pending` cujo `expires_at` já passou vira `expired` na primeira
 * consulta, então é este GET (e não o relógio do cliente) que tem a palavra
 * final sobre a expiração.
 */
export async function getPixPayment(paymentId: string): Promise<PixPaymentResult> {
  const response = await apiFetch(`/payments/${encodeURIComponent(paymentId)}`)
  return readResult(response)
}

// ---------------------------------------------------------------------------
// Classificação de estado — a tela decide por estas funções, nunca por um
// literal de `status` (ver o comentário de PixPaymentStatus).
// ---------------------------------------------------------------------------

/** Pagamento efetivamente confirmado. Decide por `confirmedAt` e pelo status da
 * FATURA — os dois dados estáveis do contrato — em vez de apostar em qual
 * literal ('paid'/'confirmed') o backend usa para o estado terminal. */
export function isPixConfirmed(payment: PixPayment): boolean {
  return payment.confirmedAt !== null || payment.invoiceStatus === 'paga'
}

/** Cobrança vencida: ou o backend já a marcou como `expired`, ou o `expiresAt`
 * ficou para trás (o cliente antecipa o que o próximo GET vai confirmar).
 * `now` entra por parâmetro para o cálculo ser testável sem fake timers. */
export function isPixExpired(payment: PixPayment, now: number): boolean {
  if (isPixConfirmed(payment)) return false
  if (payment.status === 'expired') return true
  if (payment.expiresAt === null) return false
  const expiresAtMs = new Date(payment.expiresAt).getTime()
  return Number.isFinite(expiresAtMs) && now >= expiresAtMs
}

/** Ainda aguardando confirmação — o único estado em que o polling faz sentido. */
export function isPixPending(payment: PixPayment, now: number): boolean {
  return !isPixConfirmed(payment) && !isPixExpired(payment, now) && payment.status === 'pending'
}

/** `true` quando a cobrança não é pagável de verdade (sem gateway). A tela usa
 * isto para dizer ao usuário, de forma explícita, que o código não abre em
 * nenhum app de banco — ver PixPaymentPage.tsx. */
export function isMockProvider(payment: PixPayment): boolean {
  return payment.mock || payment.provider === 'mock'
}
