// Cliente HTTP de GET /units/{id}/roles — NESTE branch (BEAC-1844/1845,
// story BEAC-1686) só a listagem, que o seletor de papel de MembersPage
// consome para oferecer as opções de troca (sistema + customizados da
// unit). POST/PATCH (criar/editar papel customizado) são escopo de
// BEAC-1684 (story irmã) e não fazem parte deste cliente — ver comentário
// de pacote em api/internal/roles/handler.go no backend.
import { apiFetch } from '../httpClient'

export interface Role {
  id: string
  /** null para roles de sistema (globais) — mesmo shape de `unit_id` na
   * resposta do backend. */
  unitId: string | null
  name: string
  isSystemRole: boolean
  isCustom: boolean
}

type RoleWire = {
  id: string
  unit_id: string | null
  name: string
  is_system_role: boolean
  is_custom: boolean
}

function fromWire(wire: RoleWire): Role {
  return {
    id: wire.id,
    unitId: wire.unit_id,
    name: wire.name,
    isSystemRole: wire.is_system_role,
    isCustom: wire.is_custom,
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

export interface ListRolesSuccess {
  ok: true
  roles: Role[]
}

export type ListRolesResult = ListRolesSuccess | ApiFailure

/**
 * GET /units/{id}/roles — roles de sistema (visíveis em qualquer unit) +
 * roles customizados desta unit específica.
 */
export async function listRoles(unitId: string): Promise<ListRolesResult> {
  const response = await apiFetch(`/units/${encodeURIComponent(unitId)}/roles`)

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as RoleWire[]
  return { ok: true, roles: body.map(fromWire) }
}
