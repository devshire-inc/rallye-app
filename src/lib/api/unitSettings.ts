// Cliente HTTP de GET/PATCH /units/{id}/settings/delinquency-block-level
// (BEAC-1866, story BEAC-1694: "Configuração dos 3 níveis de bloqueio por
// inadimplência"). Contrato confirmado lendo a implementação real do
// handler (rallye-api/api/internal/unitsettings/handler.go, BEAC-1866 já
// revisado e aprovado) em vez de assumir pela descrição da task: request e
// response são o MESMO shape JSON flat/snake_case em ambos os verbos —
// `{"delinquency_block_level": "<value>"}` — sem wrapper/envelope adicional.
// Mesmo padrão de src/lib/api/roles.ts: usa apiFetch (não fetch cru).
import { apiFetch } from '../httpClient'

/** Os 3 únicos valores válidos (decisão travada do Épico 4) — espelha
 * exatamente `validLevels` do handler real e o CHECK constraint de
 * migrations/000021_units_delinquency_block_level.up.sql (BEAC-1865). Sem
 * um 4º valor que implicasse bloqueio de Loja/Torneios: esses dois módulos
 * nunca são bloqueados, em nenhum nível (refletido na UI como hint fixo,
 * não como uma opção). */
export type DelinquencyBlockLevel = 'new_bookings_only' | 'new_bookings_and_checkin' | 'total'

type DelinquencyBlockLevelWire = {
  delinquency_block_level: DelinquencyBlockLevel
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

export interface DelinquencyBlockLevelSuccess {
  ok: true
  level: DelinquencyBlockLevel
}

export type DelinquencyBlockLevelResult = DelinquencyBlockLevelSuccess | ApiFailure

/**
 * GET /units/{id}/settings/delinquency-block-level — lê o nível atualmente
 * persistido. Autorização real (config:read) é do backend
 * (middleware.TenantContextForUnit) — este cliente só repassa o resultado.
 */
export async function getDelinquencyBlockLevel(
  unitId: string,
): Promise<DelinquencyBlockLevelResult> {
  const response = await apiFetch(
    `/units/${encodeURIComponent(unitId)}/settings/delinquency-block-level`,
  )

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as DelinquencyBlockLevelWire
  return { ok: true, level: body.delinquency_block_level }
}

/**
 * PATCH /units/{id}/settings/delinquency-block-level — edita o nível para
 * um dos 3 valores de DelinquencyBlockLevel. Autorização real
 * (config:write) é do backend — este cliente só repassa o resultado (ex.:
 * 400 se o backend rejeitar um valor fora do enum, o que não deveria
 * acontecer já que o tipo de `level` já restringe às 3 opções válidas).
 */
export async function patchDelinquencyBlockLevel(
  unitId: string,
  level: DelinquencyBlockLevel,
): Promise<DelinquencyBlockLevelResult> {
  const response = await apiFetch(
    `/units/${encodeURIComponent(unitId)}/settings/delinquency-block-level`,
    {
      method: 'PATCH',
      body: JSON.stringify({ delinquency_block_level: level } satisfies DelinquencyBlockLevelWire),
    },
  )

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as DelinquencyBlockLevelWire
  return { ok: true, level: body.delinquency_block_level }
}
