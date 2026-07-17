// Cliente HTTP de GET /units/{id}/role-audit-log (BEAC-1847, story
// BEAC-1687: "Aba Auditoria em C3: timeline de mudanças de papel"). Usa
// apiFetch (não fetch cru) — mesmo padrão de src/lib/api/units.ts: endpoint
// autenticado por sessão, apiFetch injeta cookie/Authorization e aplica o
// interceptor de refresh-on-401 (BEAC-1793).
import { apiFetch } from '../httpClient'

export interface RoleAuditActor {
  id: string
  name: string
}

export interface RoleAuditRole {
  id: string
  name: string
}

/** `text` já vem formatado pelo backend (roleaudit.formatEntry) — a UI só
 * exibe, não reimplementa a lógica "quem fez o quê" (ver comentário do
 * backend, api/internal/roleaudit/handler.go, sobre por que o verbo é
 * "alterou o papel de"/"atribuiu o papel de", não "promoveu"/"rebaixou" como
 * o protótipo — o schema de roles não tem hierarquia para calcular
 * direção). */
export interface RoleAuditEntry {
  id: string
  createdAt: string
  actor: RoleAuditActor
  target: RoleAuditActor | null
  oldRole: RoleAuditRole | null
  newRole: RoleAuditRole | null
  text: string
}

type RoleAuditEntryWire = {
  id: string
  created_at: string
  actor: RoleAuditActor
  target: RoleAuditActor | null
  old_role: RoleAuditRole | null
  new_role: RoleAuditRole | null
  text: string
}

function fromWire(wire: RoleAuditEntryWire): RoleAuditEntry {
  return {
    id: wire.id,
    createdAt: wire.created_at,
    actor: wire.actor,
    target: wire.target,
    oldRole: wire.old_role,
    newRole: wire.new_role,
    text: wire.text,
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

export interface ListRoleAuditLogSuccess {
  ok: true
  entries: RoleAuditEntry[]
  nextOffset: number | null
}

export type ListRoleAuditLogResult = ListRoleAuditLogSuccess | ApiFailure

/**
 * GET /units/{id}/role-audit-log — timeline de mudanças de papel da unit,
 * mais recente primeiro. Paginado via `offset`/`limit` (keyset por offset,
 * ver comentário do backend) — `nextOffset` é `null` quando não há mais
 * páginas.
 */
export async function listRoleAuditLog(
  unitId: string,
  options: { offset?: number; limit?: number } = {},
): Promise<ListRoleAuditLogResult> {
  const params = new URLSearchParams()
  if (options.offset !== undefined) params.set('offset', String(options.offset))
  if (options.limit !== undefined) params.set('limit', String(options.limit))
  const qs = params.toString() ? `?${params.toString()}` : ''

  const response = await apiFetch(`/units/${encodeURIComponent(unitId)}/role-audit-log${qs}`)

  if (!response.ok) return failureFrom(response)

  const body = (await response.json()) as {
    entries: RoleAuditEntryWire[]
    next_offset: number | null
  }
  return { ok: true, entries: body.entries.map(fromWire), nextOffset: body.next_offset }
}
