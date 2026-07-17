// Cliente HTTP de POST/GET/PATCH /units/{id}/roles(/{role_id}) (BEAC-1842,
// story BEAC-1684: "CRUD de papel customizado com checklist de módulos").
// Mesmo padrão de src/lib/api/units.ts: usa apiFetch (não fetch cru) —
// endpoint autenticado por sessão, apiFetch injeta cookie/Authorization e
// aplica o interceptor de refresh-on-401 (BEAC-1793).
import { apiFetch } from '../httpClient'

/** module -> lista de ações (ex.: `{ alunos: ['read','write'], agenda:
 * ['read'] }`) — mesmo shape usado pelo backend (api/internal/roles,
 * BEAC-1842), sem tradução de nome (módulo/ação já são os mesmos slugs dos
 * dois lados). */
export type RolePermissions = Record<string, string[]>

export interface Role {
  id: string
  /** null para roles de sistema (globais) — mesmo shape de `unit_id` na
   * resposta do backend. */
  unitId: string | null
  name: string
  isSystemRole: boolean
  isCustom: boolean
  permissions: RolePermissions
}

type RoleWire = {
  id: string
  unit_id: string | null
  name: string
  is_system_role: boolean
  is_custom: boolean
  permissions: RolePermissions
}

function fromWire(wire: RoleWire): Role {
  return {
    id: wire.id,
    unitId: wire.unit_id,
    name: wire.name,
    isSystemRole: wire.is_system_role,
    isCustom: wire.is_custom,
    permissions: wire.permissions,
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
 * roles customizados desta unit específica (BEAC-1842's AC de isolamento:
 * nunca inclui customizado de outra unit — garantido pelo backend, não por
 * este cliente).
 */
export async function listRoles(unitId: string): Promise<ListRolesResult> {
  const response = await apiFetch(`/units/${encodeURIComponent(unitId)}/roles`)

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as RoleWire[]
  return { ok: true, roles: body.map(fromWire) }
}

export interface CreateRolePayload {
  name: string
  permissions: RolePermissions
}

export interface CreateRoleSuccess {
  ok: true
  role: Role
}

export type CreateRoleResult = CreateRoleSuccess | ApiFailure

/** POST /units/{id}/roles — cria um papel customizado. */
export async function createRole(
  unitId: string,
  payload: CreateRolePayload,
): Promise<CreateRoleResult> {
  const response = await apiFetch(`/units/${encodeURIComponent(unitId)}/roles`, {
    method: 'POST',
    body: JSON.stringify({ name: payload.name, permissions: payload.permissions }),
  })

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as RoleWire
  return { ok: true, role: fromWire(body) }
}

export interface PatchRolePayload {
  /** Ausente (undefined) preserva o nome atual — só envia a chave "name" no
   * corpo quando o chamador quer alterá-lo (mesma semântica opcional do
   * PATCH no backend, ver PatchRequest.UnmarshalJSON). */
  name?: string
  /** Ausente (undefined) preserva as permissions atuais; um objeto (mesmo
   * `{}`) substitui o conjunto inteiro. */
  permissions?: RolePermissions
}

export interface PatchRoleSuccess {
  ok: true
  role: Role
}

export type PatchRoleResult = PatchRoleSuccess | ApiFailure

/**
 * PATCH /units/{id}/roles/{role_id} — edita nome e/ou permissions de um
 * papel customizado. Roles de sistema respondem 403 (`system_role_immutable`),
 * repassado como ApiFailure normal — a UI decide como exibir.
 */
export async function patchRole(
  unitId: string,
  roleId: string,
  payload: PatchRolePayload,
): Promise<PatchRoleResult> {
  const body: Record<string, unknown> = {}
  if (payload.name !== undefined) body.name = payload.name
  if (payload.permissions !== undefined) body.permissions = payload.permissions

  const response = await apiFetch(
    `/units/${encodeURIComponent(unitId)}/roles/${encodeURIComponent(roleId)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  )

  if (!response.ok) return failureFrom(response)

  const responseBody = (await response.json()) as RoleWire
  return { ok: true, role: fromWire(responseBody) }
}
