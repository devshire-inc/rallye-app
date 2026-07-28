// Cliente HTTP de GET /students/{id}/xp — BEAC-2092, story BEAC-1736
// (Dashboard Aluno D1). Mesmo padrão de ./skillLevels.ts: usa apiFetch, não
// fetch cru, e nunca confia silenciosamente em response.ok (união
// ok:true/ApiFailure — correção de review, rodada 1).
import { apiFetch } from '../httpClient'

export interface StudentXP {
  total_xp: number
  medal: 'Bronze' | 'Prata' | 'Ouro' | 'Platina' | 'Diamante'
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

export interface FetchStudentXPSuccess extends StudentXP {
  ok: true
}

export type FetchStudentXPResult = FetchStudentXPSuccess | ApiFailure

/** GET /students/{id}/xp — XP total e medalha de engajamento do aluno. */
export async function fetchStudentXP(studentId: string): Promise<FetchStudentXPResult> {
  const response = await apiFetch(`/students/${encodeURIComponent(studentId)}/xp`)

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as StudentXP
  return { ok: true, ...body }
}
