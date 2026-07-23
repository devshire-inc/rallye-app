// Cliente HTTP de GET /units/{id}/day-use-configs + PATCH
// /courts/{id}/day-use-config (BEAC-1954, story BEAC-1712 — "Toggle de Day
// Use por quadra em DU5"). Contrato confirmado lendo a implementação real do
// handler (rallye-api/api/internal/dayuse/handler.go, mesma dispatch) em vez
// de assumir pela descrição da task — mesmo padrão de src/lib/api/classes.ts
// (toWireBody com campos opcionais, PATCH parcial que preserva os campos não
// enviados).
import { apiFetch } from '../httpClient'

/** Dias da semana 0-6, mesma convenção de Date.getDay() (0=domingo) — usada
 * por `available_days` tanto no wire quanto na UI. Ordem de EXIBIÇÃO segue o
 * protótipo real (Seg…Dom, ver DAY_PILLS), não a ordem numérica. */
export const DAY_PILLS: Array<{ value: number; label: string }> = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
]

export interface DayUseConfig {
  courtId: string
  courtName: string
  sport: string
  enabled: boolean
  price: number | null
  slotsPerDay: number | null
  startTime: string | null
  endTime: string | null
  availableDays: number[]
}

type DayUseConfigWire = {
  court_id: string
  court_name: string
  sport: string
  enabled: boolean
  price: number | null
  slots_per_day: number | null
  start_time: string | null
  end_time: string | null
  available_days: number[] | null
}

function fromWire(wire: DayUseConfigWire): DayUseConfig {
  return {
    courtId: wire.court_id,
    courtName: wire.court_name,
    sport: wire.sport,
    enabled: wire.enabled,
    price: wire.price,
    slotsPerDay: wire.slots_per_day,
    startTime: wire.start_time,
    endTime: wire.end_time,
    availableDays: wire.available_days ?? [],
  }
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

export interface ListDayUseConfigsSuccess {
  ok: true
  configs: DayUseConfig[]
}

export type ListDayUseConfigsResult = ListDayUseConfigsSuccess | ApiFailure

/** GET /units/{id}/day-use-configs — uma entrada por quadra da unit,
 * incluindo quadras nunca configuradas (enabled=false, campos null),
 * ordenadas por nome da quadra. Autorização real (financeiro:write) é do
 * backend — este cliente só repassa o resultado. */
export async function listDayUseConfigs(unitId: string): Promise<ListDayUseConfigsResult> {
  const response = await apiFetch(`/units/${encodeURIComponent(unitId)}/day-use-configs`)

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as DayUseConfigWire[]
  return { ok: true, configs: body.map(fromWire) }
}

/** Corpo de PATCH /courts/{id}/day-use-config — todo campo é opcional, um
 * PATCH que só manda `enabled` não apaga price/slotsPerDay/startTime/
 * endTime/availableDays já persistidos (AC central da task, mesmo contrato
 * do handler real). */
export interface PatchDayUseConfigPayload {
  enabled?: boolean
  price?: number
  slotsPerDay?: number
  startTime?: string
  endTime?: string
  availableDays?: number[]
}

function toPatchWireBody(payload: PatchDayUseConfigPayload): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  if (payload.enabled !== undefined) body.enabled = payload.enabled
  if (payload.price !== undefined) body.price = payload.price
  if (payload.slotsPerDay !== undefined) body.slots_per_day = payload.slotsPerDay
  if (payload.startTime !== undefined) body.start_time = payload.startTime
  if (payload.endTime !== undefined) body.end_time = payload.endTime
  if (payload.availableDays !== undefined) body.available_days = payload.availableDays
  return body
}

export interface PatchDayUseConfigSuccess {
  ok: true
  config: DayUseConfig
}

export type PatchDayUseConfigResult = PatchDayUseConfigSuccess | ApiFailure

/** PATCH /courts/{id}/day-use-config — liga/desliga e/ou edita preço/vagas/
 * horário/dias de UMA quadra (qualquer subconjunto dos campos). Devolve a
 * config completa já atualizada, para a tela resincronizar sem um segundo
 * GET. Um 403 significa que o chamador não tem permission write em
 * 'financeiro' — a tela inteira já é gate por essa mesma permission
 * (usePermission('financeiro','write'), "esconder sempre, nunca
 * desabilitar"), então este caso não deveria ser alcançável pela UI normal. */
export async function patchDayUseConfig(
  courtId: string,
  payload: PatchDayUseConfigPayload,
): Promise<PatchDayUseConfigResult> {
  const response = await apiFetch(`/courts/${encodeURIComponent(courtId)}/day-use-config`, {
    method: 'PATCH',
    body: JSON.stringify(toPatchWireBody(payload)),
  })

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as DayUseConfigWire
  return { ok: true, config: fromWire(body) }
}
