// Cliente HTTP de GET /me (correção de review, rodada 2, BEAC-1704/
// BEAC-1926 "Minha Agenda"). Devolve o profile id do usuário logado — a
// peça de identidade que faltava no cliente pra AG3StudentAgendaPage.tsx
// escopar GET /units/{id}/bookings?student_id= à própria agenda (ver
// ../../pages/Agenda/AG3StudentAgendaPage.tsx e ./bookings.ts). Mesmo
// padrão de ./permissions.ts: usa apiFetch (não fetch cru) — endpoint
// autenticado self-access.
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

export interface GetMeSuccess {
  ok: true
  /** Profile id do chamador (session.Claims.Sub no backend). */
  id: string
  /** Nome de exibição do chamador (public.profiles.full_name no backend,
   * BEAC-2078) — consumido por useShellIdentity (BEAC-2080) pra montar o
   * userLabel real do AppShell. */
  fullName: string
}

export type GetMeResult = GetMeSuccess | ApiFailure

/**
 * GET /me — devolve { id, full_name } do usuário logado. Para sessões
 * `temporary` (Visitante), o backend responde 403 (`forbidden`) em vez de um
 * id falso — ver comentário de pacote em rallye-api/api/internal/me/handler.go.
 */
export async function getMe(): Promise<GetMeResult> {
  const response = await apiFetch('/me')
  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as { id: string; full_name: string }
  return { ok: true, id: body.id, fullName: body.full_name }
}
