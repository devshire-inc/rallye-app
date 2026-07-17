// Cliente HTTP de GET /me/permissions (BEAC-1840, story BEAC-1683). Usa
// `apiFetch` (não `fetch` cru) porque este é um endpoint autenticado
// self-access — mesmo padrão de listMyMemberships em ./units-adjacent
// lib/api.ts (cookie web + bearer token nativo + interceptor de
// refresh-on-401 de graça, ver ../httpClient.ts).
import { apiFetch } from '../httpClient'

/** Os 9 módulos da plataforma (mesmo catálogo do backend, ver
 * api/internal/permissions/handler.go `moduleCatalog`). */
export type PermissionModule =
  | 'alunos'
  | 'professores'
  | 'agenda'
  | 'financeiro'
  | 'torneios'
  | 'loja'
  | 'config'
  | 'relatorios'
  | 'quadras'

export type PermissionAction = 'read' | 'write'

/** Mapa module -> ações permitidas, exatamente como GET /me/permissions
 * devolve para uma sessão `full` — as 9 chaves de PermissionModule sempre
 * presentes (array vazio quando o role não tem nenhuma permission naquele
 * módulo, nunca omitida). */
export type PermissionsMap = Record<PermissionModule, PermissionAction[]>

export type PermissionsResult =
  | { kind: 'full'; permissions: PermissionsMap }
  // Sessão `type: temporary` (Visitante, BEAC-1819/1820): formato reduzido
  // por scope, nunca um mapa module/action (AC de BEAC-1840) — o Visitante
  // nunca usa usePermission, é autorizado via scope no backend.
  | { kind: 'temporary'; scope: string }

export class FetchPermissionsError extends Error {
  constructor() {
    super('me/permissions failed')
  }
}

interface TemporarySessionWireResponse {
  type: 'temporary'
  scope: string
}

// Type guard em vez de um union discriminado direto: o outro lado da
// resposta (mapa module->actions) tem chaves de domínio livres, então TS
// não consegue provar `body.type` como `string` em vez de `string[]` só
// pela posição do union — checar `typeof` explicitamente resolve isso sem
// recorrer a `as any`.
function isTemporarySessionResponse(body: unknown): body is TemporarySessionWireResponse {
  return (
    typeof body === 'object' &&
    body !== null &&
    'type' in body &&
    (body as { type: unknown }).type === 'temporary'
  )
}

/**
 * GET /me/permissions (BEAC-1840) — consumido por PermissionsContext
 * (BEAC-1841). Lança FetchPermissionsError em qualquer resposta não-2xx
 * (401 sem sessão, 409 arena_selection_required sem unit ativa
 * inequívoca, 500) — quem chama decide como tratar (ver
 * PermissionsContext, que trata qualquer falha como "sem permissões",
 * nunca como acesso liberado).
 */
export async function fetchMePermissions(): Promise<PermissionsResult> {
  const res = await apiFetch('/me/permissions')
  if (!res.ok) throw new FetchPermissionsError()

  const body: unknown = await res.json()
  if (isTemporarySessionResponse(body)) {
    return { kind: 'temporary', scope: body.scope }
  }

  return { kind: 'full', permissions: body as PermissionsMap }
}
