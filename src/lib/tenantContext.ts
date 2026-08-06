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
/** Arena escolhida no S1/Trocar Arena. `sessionStorage` (não `localStorage`)
 * é o que mantém o desenho "uma arena por aba" do header `X-Rallye-Unit`:
 * cada aba tem o seu próprio, então duas abas em arenas diferentes não se
 * atropelam. Ver `resolveRequestUnitId` abaixo. */
const SELECTED_UNIT_STORAGE_KEY = 'rallye:selected-unit-id'

/** `/units/{unitId}/...` — as rotas escopadas por arena, e a fonte de
 * verdade da arena da aba. Ancorado no início do path de propósito:
 * `/tenants/{id}/units` (lista de unidades do tenant) NÃO é uma rota de
 * arena ativa e não pode casar aqui. */
const UNIT_PATH_PATTERN = /^\/units\/([^/?#]+)/
/** Os ids de unit são UUID no backend. Validar antes de mandar no header
 * evita transformar uma URL digitada errada num 403 (o backend não
 * distingue "não é sua" de "não existe" de "malformada", por desenho). */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
  const resolved = resolveRequestUnitId()
  if (resolved) return resolved
  // Último recurso, e o comportamento histórico desta função: a PRIMEIRA
  // membership. Continua correto para quem só tem uma (o caso da esmagadora
  // maioria das telas sem `/units/` na URL, tipo `/perfil`), e continua
  // sendo um chute para quem tem 2+ — por isso NÃO é usado pelo header (ver
  // `getRequestUnitId`), só pela UI, que precisa de algum destino para
  // montar links mesmo antes de o usuário escolher arena.
  const [firstMembership] = readSessionMemberships()
  return firstMembership?.unit_id ?? null
}

/** Lê o `{unitId}` de `/units/{unitId}/...` no path da aba, ou null quando a
 * rota atual não é escopada por arena. */
function unitIdFromPath(): string | null {
  if (typeof window === 'undefined') return null
  const match = UNIT_PATH_PATTERN.exec(window.location.pathname)
  if (!match) return null
  const candidate = decodeURIComponent(match[1])
  return UUID_PATTERN.test(candidate) ? candidate : null
}

/**
 * Assinantes de mudança da arena ativa — existem para o
 * `useSyncExternalStore` do PermissionsContext, que monta a CHAVE de cache
 * de `/me/permissions` a partir de `getRequestUnitId()`. Se a chave não
 * acompanhar a arena, ela descreve a arena velha enquanto o header já leva a
 * nova, e a resposta de uma arena é gravada na entrada de cache da outra —
 * o erro silencioso que este desenho inteiro existe para impedir.
 *
 * As DUAS fontes de `getRequestUnitId` são observadas aqui, e nenhuma delas
 * é React: a URL (`window.location`) e a seleção do S1 (sessionStorage).
 * Observar a URL por `window.history` e não por `useLocation()` é
 * deliberado: prende o store à mesma fonte que o resolver realmente lê, e
 * evita exigir um `<Router>` ancestral do `PermissionsProvider` — que hoje é
 * montado FORA do router em ~15 testes de página (ver
 * ../test/renderWithPermissions.tsx).
 */
const activeUnitListeners = new Set<() => void>()
let historyPatched = false

/** `pushState`/`replaceState` não emitem evento nenhum (só `popstate`, e só
 * para navegação do usuário), então observar navegação de SPA exige
 * envolvê-los. Idempotente e instalado sob demanda — nada acontece se
 * ninguém se inscrever. */
function patchHistoryOnce(): void {
  if (historyPatched || typeof window === 'undefined') return
  historyPatched = true
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method].bind(window.history)
    window.history[method] = (...args: Parameters<History['pushState']>) => {
      original(...args)
      notifyActiveUnitChanged()
    }
  }
  window.addEventListener('popstate', notifyActiveUnitChanged)
}

/** Inscreve-se em mudanças da arena ativa (navegação + seleção do S1). */
export function subscribeActiveUnitId(listener: () => void): () => void {
  patchHistoryOnce()
  activeUnitListeners.add(listener)
  return () => {
    activeUnitListeners.delete(listener)
  }
}

function notifyActiveUnitChanged(): void {
  for (const listener of activeUnitListeners) listener()
}

/** Marca a arena escolhida no S1/Trocar Arena. Chamado ANTES do refetch de
 * permissions e da navegação (ver S1Page.enterMembership): é o que faz o
 * `GET /me/permissions` disparado ainda em `/s1` — uma rota sem `/units/` —
 * já sair com o header da arena nova. */
export function setSelectedUnitId(unitId: string): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(SELECTED_UNIT_STORAGE_KEY, unitId)
  notifyActiveUnitChanged()
}

/** Esquece a arena escolhida — logout. Uma seleção sobrevivente mandaria o
 * header de uma arena que o próximo usuário desta aba não tem, e o backend
 * responde 403 a isso. */
export function clearSelectedUnitId(): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(SELECTED_UNIT_STORAGE_KEY)
  notifyActiveUnitChanged()
}

/**
 * A arena desta aba, na precedência que o header `X-Rallye-Unit` usa:
 *
 * 1. **URL** (`/units/{unitId}/...`). Sempre vence: é a arena que a tela na
 *    frente do usuário está de fato exibindo, e é o que faz duas abas em
 *    arenas diferentes funcionarem sem estado global disputado.
 * 2. **Seleção do S1/Trocar Arena** persistida por aba. Cobre as telas
 *    legítimas fora de `/units/...` que ainda são escopadas por arena
 *    (`/perfil`, `/notificacoes`, `/invoices/{id}`, `/trocar-arena`, o
 *    `/dashboard` genérico), que hoje tomam 409 para quem tem 2+
 *    memberships.
 * 3. **Nada.** Sem URL e sem seleção, não se inventa valor: o header não vai
 *    e o backend cai no comportamento antigo (1 membership resolve; 2+ dá
 *    409 honesto). Mandar um palpite seria trocar o 409 por um 403 — pior,
 *    porque o 403 é indistinguível de "arena de outro usuário".
 *
 * Um `/units/{segmento}` que não seja UUID devolve null SEM cair para a
 * seleção persistida: nesse caso a tela está pedindo dados de uma arena da
 * URL, e mandar o header de OUTRA arena misturaria escopos (path de uma,
 * header de outra) — que é justamente a classe de erro silencioso que este
 * desenho quer evitar.
 */
function resolveRequestUnitId(): string | null {
  if (typeof window === 'undefined') return null
  if (UNIT_PATH_PATTERN.test(window.location.pathname)) return unitIdFromPath()
  const selected = window.sessionStorage.getItem(SELECTED_UNIT_STORAGE_KEY)
  return selected && UUID_PATTERN.test(selected) ? selected : null
}

/**
 * A arena que deve viajar no header `X-Rallye-Unit` desta requisição — e a
 * mesma que entra nas CHAVES de cache do react-query dos dados escopados por
 * arena (ver ../lib/query/identity.ts). É de propósito que as duas coisas
 * leiam a mesma função: uma chave de cache que discorde do header é
 * exatamente como se serve dado da arena errada sem nenhum erro aparecer.
 */
export function getRequestUnitId(): string | null {
  return resolveRequestUnitId()
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
