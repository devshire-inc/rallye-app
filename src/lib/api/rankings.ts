// Cliente HTTP de GET /rankings (Épico 4, BEAC-1855 — já em produção; consumido
// aqui pela TO8/BEAC-2009 sem nenhuma mudança de contrato). Mesmo padrão de
// src/lib/api/invoices.ts: usa apiFetch, não fetch cru; tipos wire (snake_case)
// convertidos pra camelCase na borda.
import { apiFetch } from '../httpClient'

export type RankingScope = 'arena' | 'cidade' | 'estado' | 'nacional' | 'rede'

export interface ApiFailure {
  ok: false
  status: number
  error: string
}

async function failureFrom(response: Response): Promise<ApiFailure> {
  const body = await response.json().catch(() => ({}))
  return { ok: false, status: response.status, error: body.error ?? 'unknown_error' }
}

// ---------------------------------------------------------------------------
// GET /rankings — ranking por escopo (BEAC-1855)
// ---------------------------------------------------------------------------

export interface RankingEntry {
  studentId: string
  name: string
  totalPoints: number
}

type RankingEntryWire = {
  student_id: string
  name: string
  total_points: number
}

function fromEntryWire(wire: RankingEntryWire): RankingEntry {
  return { studentId: wire.student_id, name: wire.name, totalPoints: wire.total_points }
}

export interface GetRankingsSuccess {
  ok: true
  scope: RankingScope
  rankings: RankingEntry[]
}

export type GetRankingsResult = GetRankingsSuccess | ApiFailure

export interface GetRankingsParams {
  scope: RankingScope
  /** Obrigatório quando scope='arena'. */
  unitId?: string
  /** Obrigatório quando scope='cidade'. */
  city?: string
  /** Obrigatório quando scope='estado'. */
  state?: string
  /** Obrigatório quando scope='rede'. */
  tenantId?: string
}

/** GET /rankings?scope=&unit_id=|city=|state=|tenant_id= — o backend não
 * pagina (devolve o resultado inteiro) nem marca a linha do usuário logado
 * (sem is_me/trend na resposta): a TO8 precisa comparar student_id
 * client-side contra o usuário atual pra destacar sua linha. */
export async function getRankings(params: GetRankingsParams): Promise<GetRankingsResult> {
  const query = new URLSearchParams({ scope: params.scope })
  if (params.scope === 'arena' && params.unitId) query.set('unit_id', params.unitId)
  if (params.scope === 'cidade' && params.city) query.set('city', params.city)
  if (params.scope === 'estado' && params.state) query.set('state', params.state)
  if (params.scope === 'rede' && params.tenantId) query.set('tenant_id', params.tenantId)

  const response = await apiFetch(`/rankings?${query.toString()}`)
  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as { scope: RankingScope; rankings: RankingEntryWire[] }
  return { ok: true, scope: body.scope, rankings: body.rankings.map(fromEntryWire) }
}
