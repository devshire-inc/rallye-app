/**
 * Deriva o tenant ativo do usuário logado a partir das memberships reais da
 * sessão (BEAC-1680/1832, decisão do relatório de execução: `session.Membership`
 * agora carrega `tenant_id` além de `unit_id` — ver `api/internal/session/claims.go`
 * e `SessionResponse`/`LoginResult` em ./httpClient.ts — e o frontend deriva o
 * tenant ativo dali, sem necessidade de um novo endpoint `GET /auth/me`).
 *
 * `setSessionMemberships` é chamado por httpClient.ts logo após um
 * login/refresh bem-sucedido, persistindo as memberships em sessionStorage
 * (mesmo escopo de vida da sessão web, que depende do cookie `rallye_session`
 * — ver httpClient.ts). `getActiveTenantId` deriva o tenant ativo de
 * qualquer membership disponível: um Tenant Owner sempre tem ao menos uma
 * membership no próprio tenant (decisão 3 do relatório de execução).
 *
 * `setActiveTenantId` continua existindo como um override manual (útil para
 * QA/testes que já sabem o tenantId de antemão) e, quando setado, tem
 * prioridade sobre a derivação automática das memberships.
 */
const ACTIVE_TENANT_OVERRIDE_KEY = 'rallye:active-tenant-id'
const MEMBERSHIPS_STORAGE_KEY = 'rallye:session-memberships'

export interface Membership {
  unit_id: string
  tenant_id: string
}

/** Persiste as memberships da sessão atual — chamado por httpClient.ts após
 * login/refresh/checkExistingSession bem-sucedidos. Não é destinado a ser
 * chamado diretamente por código de UI. */
export function setSessionMemberships(memberships: Membership[]): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(MEMBERSHIPS_STORAGE_KEY, JSON.stringify(memberships))
}

function readSessionMemberships(): Membership[] {
  if (typeof window === 'undefined') return []
  const raw = window.sessionStorage.getItem(MEMBERSHIPS_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Membership[]) : []
  } catch {
    return []
  }
}

/**
 * Retorna o tenant_id ativo do usuário logado, derivado das memberships
 * reais persistidas por setSessionMemberships (ver comentário do módulo).
 * Retorna null quando não há sessão/memberships disponíveis ainda (ex.: SSR,
 * ou nenhum login/refresh bem-sucedido nesta aba).
 */
export function getActiveTenantId(): string | null {
  if (typeof window === 'undefined') return null
  const manualOverride = window.sessionStorage.getItem(ACTIVE_TENANT_OVERRIDE_KEY)
  if (manualOverride) return manualOverride
  const [firstMembership] = readSessionMemberships()
  return firstMembership?.tenant_id ?? null
}

/** Override manual do tenant ativo (QA/testes) — tem prioridade sobre a
 * derivação automática das memberships enquanto estiver setado. */
export function setActiveTenantId(tenantId: string): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(ACTIVE_TENANT_OVERRIDE_KEY, tenantId)
}

/**
 * Retorna o unit_id ativo do usuário logado (BEAC-1843/BEAC-1845/BEAC-1848,
 * stories BEAC-1684/1686/1687), mesma derivação de getActiveTenantId acima
 * (primeira membership persistida por setSessionMemberships) — não existia
 * ainda um equivalente "unit ativa" neste módulo (só tenant). Consumido pela
 * tela C3 (Papéis e permissões, rota `/units/:unitId/roles`), pela tela de
 * membros da unidade (rota `/units/:unitId/members`) e pela tela de
 * histórico de auditoria (rota `/units/:unitId/role-audit-log`), todas
 * unit-scoped no backend. Sem override manual dedicado (ao contrário de
 * setActiveTenantId): nenhum consumidor desta função precisou de um ainda —
 * adicionar se/quando um caso de uso pedir.
 */
export function getActiveUnitId(): string | null {
  if (typeof window === 'undefined') return null
  const [firstMembership] = readSessionMemberships()
  return firstMembership?.unit_id ?? null
}

/**
 * Retorna TODAS as memberships da sessão atual (AG4, dispatch avulso — sem
 * story/task no Allye): um professor cross-arena precisa buscar bookings em
 * cada unit onde tem membership, não só a "ativa" (primeira). Simplesmente
 * expõe o que readSessionMemberships já fazia internamente — nenhuma lógica
 * nova, só visibilidade pra fora deste módulo.
 */
export function getSessionMemberships(): Membership[] {
  return readSessionMemberships()
}
