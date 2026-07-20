// Cliente HTTP da story BEAC-1708 ("Tela AG9 com contagem regressiva de
// confirmação de vaga") — consumido pelos sheets AG8 "Fila de espera"
// (WaitlistSheet.tsx, BEAC-1922) e AG9 "Confirmação de vaga" (OfferSheet.tsx,
// BEAC-1923). Mesmo padrão de src/lib/api/reschedule.ts: usa apiFetch, não
// fetch cru.
//
// GET /classes/{id}/waitlist não estava em nenhuma das 4 tasks de backend
// desta story — gap de leitura descoberto ao planejar este sheet (AC pede
// "mostra turma, ocupação atual, tamanho da fila, posição estimada", mas
// nenhum endpoint devolvia isso antes de entrar na fila). Coberto na MESMA
// dispatch, mesmo precedente já usado por list_credits_handler.go/AG7 nesta
// story — decisão confirmada com o usuário durante a execução.
import { apiFetch } from '../httpClient'

export interface ApiFailure {
  ok: false
  status: number
  error: string
  message?: string
}

async function failureFrom(response: Response): Promise<ApiFailure> {
  const body = await response.json().catch(() => ({}))
  return { ok: false, status: response.status, error: body.error ?? 'unknown_error', message: body.message }
}

export interface WaitlistStatusSuccess {
  ok: true
  activeEnrollments: number
  capacity: number
  queueSize: number
  /** null quando o chamador não tem uma entrada 'waiting' nesta turma. */
  yourPosition: number | null
}

export type WaitlistStatusResult = WaitlistStatusSuccess | ApiFailure

/** GET /classes/{id}/waitlist — ocupação atual, tamanho da fila e a posição
 * do PRÓPRIO aluno logado (se ele já estiver na fila). Nunca revela
 * identidade de outros alunos na fila. */
export async function getWaitlistStatus(classId: string): Promise<WaitlistStatusResult> {
  const response = await apiFetch(`/classes/${encodeURIComponent(classId)}/waitlist`)
  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as {
    active_enrollments: number
    capacity: number
    queue_size: number
    your_position?: number
  }
  return {
    ok: true,
    activeEnrollments: body.active_enrollments,
    capacity: body.capacity,
    queueSize: body.queue_size,
    yourPosition: body.your_position ?? null,
  }
}

export interface JoinWaitlistSuccess {
  ok: true
  id: string
  position: number
}

export type JoinWaitlistResult = JoinWaitlistSuccess | ApiFailure

/** POST /classes/{id}/waitlist — o aluno logado entra na fila de espera da
 * turma. Rejeita (409) quando a turma não está lotada (class_not_full), a
 * fila já tem 5 pessoas (queue_full) ou o aluno já está na fila
 * (already_in_queue). */
export async function joinWaitlist(classId: string): Promise<JoinWaitlistResult> {
  const response = await apiFetch(`/classes/${encodeURIComponent(classId)}/waitlist`, { method: 'POST' })
  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as { id: string; position: number }
  return { ok: true, id: body.id, position: body.position }
}

export interface LeaveWaitlistSuccess {
  ok: true
}

export type LeaveWaitlistResult = LeaveWaitlistSuccess | ApiFailure

/** DELETE /classes/{id}/waitlist/{student_id} — sai da fila a qualquer
 * momento (idempotente: sair sem estar na fila também devolve sucesso). */
export async function leaveWaitlist(classId: string, studentId: string): Promise<LeaveWaitlistResult> {
  const response = await apiFetch(
    `/classes/${encodeURIComponent(classId)}/waitlist/${encodeURIComponent(studentId)}`,
    { method: 'DELETE' },
  )
  if (!response.ok) return failureFrom(response)
  return { ok: true }
}

export type OfferStatus = 'accepted' | 'expired'

export interface AcceptOfferSuccess {
  ok: true
  status: OfferStatus
  entryId: string
  classId: string
  /** Ocorrência já disponível na agenda do aluno — vazio quando nenhuma
   * ocorrência futura foi encontrada (ver comentário de pacote em
   * offer_handler.go) ou quando a oferta expirou (status='expired'). */
  bookingId?: string
}

export type AcceptOfferResult = AcceptOfferSuccess | ApiFailure

/** POST /waitlist/{id}/accept — confirma a vaga oferecida. IMPORTANTE:
 * expiração é decidida pelo SERVIDOR, nunca pelo timer do cliente — mesmo
 * quando o prazo já passou, este endpoint devolve 200 com status='expired'
 * (não um erro HTTP: a mesma chamada já dispara a passagem pro próximo da
 * fila, ver comentário de pacote em offer_handler.go — um 4xx aqui
 * descartaria esse efeito). Quem chama deve checar `status`, não `ok`, para
 * distinguir aceite de expiração. */
export async function acceptOffer(entryId: string): Promise<AcceptOfferResult> {
  const response = await apiFetch(`/waitlist/${encodeURIComponent(entryId)}/accept`, { method: 'POST' })
  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as { status: OfferStatus; entry_id: string; class_id: string; booking_id?: string }
  return { ok: true, status: body.status, entryId: body.entry_id, classId: body.class_id, bookingId: body.booking_id }
}

export interface DeclineOfferSuccess {
  ok: true
  status: 'declined'
  entryId: string
}

export type DeclineOfferResult = DeclineOfferSuccess | ApiFailure

/** POST /waitlist/{id}/decline — recusa a vaga oferecida, dispara a
 * passagem pro próximo da fila (independente do prazo). */
export async function declineOffer(entryId: string): Promise<DeclineOfferResult> {
  const response = await apiFetch(`/waitlist/${encodeURIComponent(entryId)}/decline`, { method: 'POST' })
  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as { status: 'declined'; entry_id: string }
  return { ok: true, status: body.status, entryId: body.entry_id }
}
