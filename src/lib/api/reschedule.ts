// Cliente HTTP da story BEAC-1705 ("Geração de crédito ao cancelar aula") —
// consumido pelo sheet AG7 "Remarcar" (BEAC-1912, RemarcarSheet.tsx):
//
//   - GET /students/{id}/reschedule-credits (rallye-api/api/internal/reschedule/
//     list_credits_handler.go) — créditos DISPONÍVEIS do aluno logado. Gap de
//     leitura coberto pela MESMA dispatch desta task (nenhuma story anterior
//     tinha um endpoint de leitura de créditos) — usado para mostrar o toast
//     "N crédito(s) de reagendamento disponível(is) este mês" com a contagem
//     REAL, não a cópia hardcoded do protótipo (decisão já travada por
//     BEAC-1915 e reaplicada aqui).
//   - GET /units/{id}/reschedule-config (config_handler.go) — se a unit exige
//     aprovação do admin pra remarcação, pro foot-note condicional.
//   - POST /students/{id}/reschedule (reschedule_handler.go) — consome um
//     crédito pra se matricular numa ocorrência de destino.
//
// Mesmo padrão de src/lib/api/bookings.ts: usa apiFetch, não fetch cru.
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

export interface RescheduleCredit {
  id: string
  /** ISO/RFC3339. */
  grantedAt: string
  /** ISO/RFC3339. */
  expiresAt: string
  sourceBookingId: string
}

type RescheduleCreditWire = {
  id: string
  granted_at: string
  expires_at: string
  source_booking_id: string
}

function creditFromWire(wire: RescheduleCreditWire): RescheduleCredit {
  return {
    id: wire.id,
    grantedAt: wire.granted_at,
    expiresAt: wire.expires_at,
    sourceBookingId: wire.source_booking_id,
  }
}

export interface ListRescheduleCreditsSuccess {
  ok: true
  credits: RescheduleCredit[]
}

export type ListRescheduleCreditsResult = ListRescheduleCreditsSuccess | ApiFailure

/** GET /students/{id}/reschedule-credits — créditos disponíveis (não usados,
 * não expirados) do aluno `{id}`. Self-only no backend: só funciona para o
 * próprio usuário logado (403 caso contrário). */
export async function listRescheduleCredits(studentId: string): Promise<ListRescheduleCreditsResult> {
  const response = await apiFetch(`/students/${encodeURIComponent(studentId)}/reschedule-credits`)
  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as { credits: RescheduleCreditWire[] }
  return { ok: true, credits: body.credits.map(creditFromWire) }
}

export interface GetRescheduleConfigSuccess {
  ok: true
  requiresApproval: boolean
}

export type GetRescheduleConfigResult = GetRescheduleConfigSuccess | ApiFailure

/** GET /units/{id}/reschedule-config — se a unit exige aprovação do admin
 * pra aplicar uma remarcação (public.units.reschedule_requires_approval). */
export async function getRescheduleConfig(unitId: string): Promise<GetRescheduleConfigResult> {
  const response = await apiFetch(`/units/${encodeURIComponent(unitId)}/reschedule-config`)
  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as { requires_approval: boolean }
  return { ok: true, requiresApproval: body.requires_approval }
}

export type RescheduleStatus = 'applied' | 'pending_approval'

export interface CreateRescheduleSuccess {
  ok: true
  status: RescheduleStatus
  creditId: string
  targetBookingId?: string
  pendingApprovalId?: string
}

export type CreateRescheduleResult = CreateRescheduleSuccess | ApiFailure

/**
 * POST /students/{id}/reschedule — consome `creditId` pra se matricular na
 * ocorrência `targetBookingId`. Quando a unit exige aprovação
 * (getRescheduleConfig), devolve status='pending_approval' SEM aplicar a
 * remarcação ainda (fica um public.pending_approvals aguardando o admin);
 * senão, status='applied' (crédito usado, aluno já matriculado no destino).
 */
export async function createReschedule(
  studentId: string,
  creditId: string,
  targetBookingId: string,
): Promise<CreateRescheduleResult> {
  const response = await apiFetch(`/students/${encodeURIComponent(studentId)}/reschedule`, {
    method: 'POST',
    body: JSON.stringify({ credit_id: creditId, target_booking_id: targetBookingId }),
  })
  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as {
    status: RescheduleStatus
    credit_id: string
    target_booking_id?: string
    pending_approval_id?: string
  }
  return {
    ok: true,
    status: body.status,
    creditId: body.credit_id,
    targetBookingId: body.target_booking_id,
    pendingApprovalId: body.pending_approval_id,
  }
}
