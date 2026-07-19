// Cliente HTTP de GET /units/{id}/courts — endpoint NOVO, adicionado como
// parte deste mesmo dispatch (BEAC-1903/BEAC-1904, story BEAC-1704 "CRUD de
// turma com recorrência semanal") porque nenhuma story anterior tinha criado
// um jeito de listar as quadras de uma unit: `public.courts` existe desde
// migrations/000032 (nome, esporte principal, status active/maintenance),
// mas só era consumido indiretamente via JOIN em GET /units/{id}/bookings
// (api/internal/bookings/handler.go, GridHandler) — que só devolve quadras
// com pelo menos uma reserva na janela consultada. Isso não é suficiente
// para AG1 (colunas = TODA quadra ativa, incluindo as sem reserva nenhuma
// no dia) nem para o overlay de manutenção (`.col-blocked`, precisa saber
// quais quadras têm status=maintenance mesmo sem bookings), nem para o
// dropdown de quadra de AG2/AG6. Endpoint adicionado no backend real
// (rallye-api/api/internal/courts) como parte do mesmo dispatch — ver
// handler lá para o contrato exato.
//
// Mesmo padrão de src/lib/api/students.ts: usa apiFetch (não fetch cru).
import { apiFetch } from '../httpClient'

/** Espelha o CHECK de public.courts.status (migrations/000032). */
export type CourtStatus = 'active' | 'maintenance'

export interface Court {
  id: string
  unitId: string
  name: string
  /** Esporte principal da quadra — um dos 4 slugs de src/lib/sports.ts. */
  sport: string
  status: CourtStatus
}

type CourtWire = {
  id: string
  unit_id: string
  name: string
  sport: string
  status: CourtStatus
}

function fromWire(wire: CourtWire): Court {
  return { id: wire.id, unitId: wire.unit_id, name: wire.name, sport: wire.sport, status: wire.status }
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

export interface ListCourtsSuccess {
  ok: true
  courts: Court[]
}

export type ListCourtsResult = ListCourtsSuccess | ApiFailure

/** GET /units/{id}/courts — lista todas as quadras da unit (ativas e em
 * manutenção — o AC de AG1 precisa das duas para desenhar o overlay
 * `.col-blocked`), ordenadas por nome. */
export async function listCourts(unitId: string): Promise<ListCourtsResult> {
  const response = await apiFetch(`/units/${encodeURIComponent(unitId)}/courts`)

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as CourtWire[]
  return { ok: true, courts: body.map(fromWire) }
}
