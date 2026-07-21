// Cliente HTTP de PATCH /teachers/{id}/remuneration (BEAC-1879/BEAC-1880) —
// rallye-api/api/internal/remuneration/handler.go. SOMENTE Admin
// (professores:write) — sem bypass de self, professor nunca edita a própria
// remuneração por este endpoint (ver comentário de pacote do handler real).
import { apiFetch } from '../httpClient'
import type { RemunerationModel } from './teachers'

export interface PatchRemunerationPayload {
  remunerationModel: RemunerationModel
  remunerationValue: number
}

export interface PatchRemunerationSuccess {
  ok: true
  remunerationModel: RemunerationModel
  remunerationValue: number
  historyRowCreated: boolean
}

export interface ApiFailure {
  ok: false
  status: number
  error: string
  message?: string
}

export type PatchRemunerationResult = PatchRemunerationSuccess | ApiFailure

/** PATCH /teachers/{id}/remuneration. */
export async function patchRemuneration(
  teacherId: string,
  payload: PatchRemunerationPayload,
): Promise<PatchRemunerationResult> {
  const response = await apiFetch(`/teachers/${encodeURIComponent(teacherId)}/remuneration`, {
    method: 'PATCH',
    body: JSON.stringify({
      remuneration_model: payload.remunerationModel,
      remuneration_value: payload.remunerationValue,
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

  return {
    ok: true,
    remunerationModel: body.remuneration_model,
    remunerationValue: body.remuneration_value,
    historyRowCreated: body.history_row_created ?? false,
  }
}
