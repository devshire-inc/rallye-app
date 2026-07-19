// Cliente HTTP de POST /teachers/{id}/block-requests (BEAC-1888, story
// BEAC-1702 — "Formulário de solicitação de bloqueio (AG10)"). Contrato lido
// diretamente do handler real em
// rallye-api-beac1702/api/internal/blockrequests/handler.go antes de
// escrever este cliente:
//
//   - POST /teachers/{id}/block-requests body { start_date, end_date,
//     reason } (ISO 8601) -> 201 { id, status, created_at }. status sempre
//     "pending" na criação (nenhum mecanismo de auto-aprovação).
//   - Autorização é self-only: só o professor dono de {id} pode chamar —
//     tentativa de criar para outro professor volta 403 forbidden.
//   - reason vazio/ausente volta 400 invalid_body com uma `message` amigável
//     ("Conte o motivo pra o admin decidir.") — repassada aqui em vez de só
//     o código de erro, para a UI (BEAC-1889) poder exibir a mensagem exata
//     do protótipo sem duplicá-la.
import { apiFetch } from '../httpClient'

export interface CreateTeacherBlockRequestPayload {
  /** ISO 8601 (ex.: resultado de `new Date(...).toISOString()`). */
  startDate: string
  /** ISO 8601. */
  endDate: string
  reason: string
}

export interface ApiFailure {
  ok: false
  status: number
  error: string
  /** Mensagem amigável opcional devolvida pelo backend (ex.: erro de
   * validação de reason) — nem toda falha tem uma (ex.: 403 forbidden só
   * tem `error`). */
  message?: string
}

async function failureFrom(response: Response): Promise<ApiFailure> {
  const body = await response.json().catch(() => ({}))
  return {
    ok: false,
    status: response.status,
    error: body.error ?? 'unknown_error',
    message: body.message,
  }
}

export interface CreateTeacherBlockRequestSuccess {
  ok: true
  id: string
  status: string
  createdAt: string
}

export type CreateTeacherBlockRequestResult = CreateTeacherBlockRequestSuccess | ApiFailure

type CreateTeacherBlockRequestWire = {
  id: string
  status: string
  created_at: string
}

/** POST /teachers/{id}/block-requests — professor solicita bloqueio da
 * própria agenda; `teacherId` só pode ser o id do PRÓPRIO chamador (AC de
 * BEAC-1888: "nunca para outro professor"), o backend rejeita com 403 caso
 * contrário. */
export async function createTeacherBlockRequest(
  teacherId: string,
  payload: CreateTeacherBlockRequestPayload,
): Promise<CreateTeacherBlockRequestResult> {
  const response = await apiFetch(`/teachers/${encodeURIComponent(teacherId)}/block-requests`, {
    method: 'POST',
    body: JSON.stringify({
      start_date: payload.startDate,
      end_date: payload.endDate,
      reason: payload.reason,
    }),
  })

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as CreateTeacherBlockRequestWire
  return { ok: true, id: body.id, status: body.status, createdAt: body.created_at }
}
