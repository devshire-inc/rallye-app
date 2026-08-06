/**
 * Cliente HTTP único e reutilizável por toda a app (BEAC-1793).
 *
 * - Sempre chama com `credentials: 'include'` para que o cookie
 *   `rallye_session` (setado pelo BFF) viaje nas requisições web.
 * - No mobile (Capacitor nativo), não há cookies: o token persistido via
 *   secure storage (BEAC-1795) é anexado como `Authorization: Bearer`.
 * - Interceptor global: qualquer 401 (exceto no próprio /auth/login e
 *   /auth/refresh, para não entrar em loop) tenta `POST /auth/refresh` uma
 *   única vez; se o refresh funcionar, repete a chamada original; senão,
 *   dispara um evento para a app redirecionar para o login.
 *
 * Não decide como navegar para o /login — isso é responsabilidade de quem
 * consome o evento `rallye:session-expired` (ver App.tsx), mantendo este
 * módulo livre de qualquer dependência de roteador.
 */
import {
  getRefreshToken,
  getSessionToken,
  isNativePlatform,
  setRefreshToken,
  setSessionToken,
} from './secureStorage'
import { getRequestUnitId, type Membership, setSessionMemberships } from './tenantContext'

export const SESSION_EXPIRED_EVENT = 'rallye:session-expired'
/**
 * Disparado sempre que uma sessão (memberships) é persistida com sucesso —
 * login, checkExistingSession (refresh no boot), E tryRefresh (todo refresh
 * silencioso de token, em qualquer chamada de API cujo access token tenha
 * expirado durante a navegação normal — não só login/boot), ver
 * persistSessionResponse abaixo, chamada pelos três. PermissionsContext
 * (BEAC-1841) escuta este evento para buscar GET /me/permissions assim que
 * uma sessão fica disponível, sem acoplar este módulo (livre de React) a
 * nenhum contexto/estado de UI — mesmo padrão já usado por
 * SESSION_EXPIRED_EVENT/App.tsx. Refetch redundante em todo refresh
 * silencioso é aceitável: permissions raramente mudam no meio de uma
 * sessão e o refetch é idempotente (ver PermissionsContext).
 */
export const SESSION_ESTABLISHED_EVENT = 'rallye:session-established'

const AUTH_LOGIN_PATH = '/auth/login'
const AUTH_REFRESH_PATH = '/auth/refresh'
const AUTH_LOGOUT_PATH = '/auth/logout'
const AUTH_INVITE_COMPLETE_PATH = '/auth/invite/complete'

export type { Membership }

export interface SessionResponse {
  session_token: string
  refresh_token: string
  memberships: Membership[]
}

export interface LoginResult {
  ok: boolean
  memberships: Membership[]
}

function apiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? ''
}

function dispatchSessionExpired(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  }
}

function dispatchSessionEstablished(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_ESTABLISHED_EVENT))
  }
}

async function persistSessionResponse(data: SessionResponse): Promise<void> {
  // Memberships (com tenant_id) viajam no corpo JSON em ambas plataformas —
  // persistidas sempre, para que tenantContext.getActiveTenantId() as
  // encontre independentemente de web/mobile.
  setSessionMemberships(data.memberships ?? [])
  dispatchSessionEstablished()

  if (!isNativePlatform()) return
  await Promise.all([setSessionToken(data.session_token), setRefreshToken(data.refresh_token)])
}

/**
 * Header que define a arena ativa DA REQUISIÇÃO (backend `0ffc008`, já no
 * ar). Antes dele o servidor só conseguia derivar a arena quando o usuário
 * tinha exatamente uma membership — com 0 ou 2+ respondia `409
 * arena_selection_required`, porque a escolha feita no S1 vivia só na rota
 * do frontend e nunca chegava ao servidor.
 *
 * Contrato do backend (não mude sem mudar lá):
 *   - ausente          -> comportamento antigo (1 membership resolve; 0/2+ -> 409)
 *   - membership sua   -> 200
 *   - qualquer outra coisa (arena alheia, inexistente, malformada) -> 403,
 *     indistinguíveis entre si de propósito (não vazam existência)
 *
 * Por isso o valor NUNCA é chutado: ver `getRequestUnitId` em
 * ./tenantContext.ts, que devolve null quando não há arena conhecida — um
 * 409 honesto é melhor que um 403.
 */
export const ACTIVE_UNIT_HEADER = 'X-Rallye-Unit'

/**
 * Headers comuns a TODA chamada autenticada do app. Exportado porque os
 * clientes "visitor-safe" (../lib/api/tournamentWithdrawal.ts e
 * ../lib/api/tournamentBrackets.ts) replicam deliberadamente o `fetch` sem o
 * interceptor de refresh/redirect deste módulo, mas precisam dos MESMOS
 * headers — sem isto, a injeção do `X-Rallye-Unit` estaria duplicada em três
 * arquivos e sairia de sincronia no primeiro ajuste.
 *
 * Vale igual no caminho nativo (Capacitor): o header de arena é ortogonal ao
 * `Authorization: Bearer` — os dois são setados aqui, no mesmo lugar, e
 * nenhum depende de cookie.
 */
export async function buildHeaders(init?: RequestInit): Promise<Headers> {
  const headers = new Headers(init?.headers)
  if (isNativePlatform()) {
    const token = await getSessionToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
  }
  // Não sobrescreve um valor explícito de quem chamou (nenhum call site faz
  // isso hoje; a guarda existe para que passar a fazer seja possível sem
  // surpresa).
  if (!headers.has(ACTIVE_UNIT_HEADER)) {
    const unitId = getRequestUnitId()
    if (unitId) headers.set(ACTIVE_UNIT_HEADER, unitId)
  }
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return headers
}

/** Chama POST /auth/refresh cru (sem passar pelo interceptor de apiFetch,
 * que trataria esta própria chamada como alvo de refresh). Retorna null em
 * qualquer falha (rede ou 401) sem lançar. */
async function callRefreshEndpoint(): Promise<SessionResponse | null> {
  try {
    const body = isNativePlatform() ? { refresh_token: await getRefreshToken() } : undefined
    const response = await fetch(apiBaseUrl() + AUTH_REFRESH_PATH, {
      method: 'POST',
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!response.ok) return null
    return (await response.json()) as SessionResponse
  } catch {
    return null
  }
}

let refreshInFlight: Promise<boolean> | null = null

/** Tenta renovar a sessão via POST /auth/refresh (compartilhando uma única
 * chamada em voo entre requisições concorrentes que colidiram em 401). */
async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const data = await callRefreshEndpoint()
      if (!data) return false
      await persistSessionResponse(data)
      return true
    })().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

/**
 * apiFetch é o único ponto de entrada HTTP da app: injeta credenciais/
 * headers apropriados e aplica o interceptor de refresh-on-401.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = await buildHeaders(init)
  const response = await fetch(apiBaseUrl() + path, {
    ...init,
    credentials: 'include',
    headers,
  })

  const isAuthEndpoint =
    path === AUTH_LOGIN_PATH || path === AUTH_REFRESH_PATH || path === AUTH_INVITE_COMPLETE_PATH
  if (response.status !== 401 || isAuthEndpoint) {
    return response
  }

  const refreshed = await tryRefresh()
  if (!refreshed) {
    dispatchSessionExpired()
    return response
  }

  const retryHeaders = await buildHeaders(init)
  return fetch(apiBaseUrl() + path, {
    ...init,
    credentials: 'include',
    headers: retryHeaders,
  })
}

/** POST /auth/login com e-mail/senha. */
export async function login(email: string, password: string): Promise<LoginResult> {
  const response = await apiFetch(AUTH_LOGIN_PATH, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    return { ok: false, memberships: [] }
  }

  const data = (await response.json()) as SessionResponse
  await persistSessionResponse(data)
  return { ok: true, memberships: data.memberships ?? [] }
}

export type CompleteInviteErrorCode =
  'invalid_code' | 'code_expired' | 'too_many_attempts' | 'validation' | 'upstream_error'

export class CompleteInviteError extends Error {
  code: CompleteInviteErrorCode
  constructor(code: CompleteInviteErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

/**
 * POST /auth/invite/complete (BEAC-1860): "definir senha" da tela de
 * completar cadastro via convite. Mesma mecânica de verificação por código
 * de 6 dígitos do fluxo A3/Esqueci Senha (BEAC-1675 — RequestRecovery +
 * VerifyRecoveryOTP + UpdatePassword no Supabase, reaproveitada sem
 * mudanças para a ETAPA DE ENVIO do código: ver requestPasswordReset em
 * lib/passwordReset.ts, chamada por esta tela para disparar o e-mail com o
 * código), mas com uma diferença deliberada na etapa de confirmação: A3
 * encerra todas as sessões (SignOutGlobal) porque é alguém redefinindo a
 * senha de uma conta já ativa; aqui é a ATIVAÇÃO inicial de uma conta criada
 * pelo Admin via convite (BEAC-1858) — o aluno precisa ficar autenticado
 * (esta chamada estabelece sessão) para então chamar POST /invites/{code}/redeem
 * (BEAC-1807, inalterado) e criar sua membership. Por isso a resposta de
 * sucesso aqui tem o MESMO formato de /auth/login (SessionResponse) em vez
 * de simplesmente uma mensagem de confirmação.
 *
 * Endpoint implementado em BEAC-1870 (api/auth/invite_complete_handler.go,
 * rallye-api) — mesmo contrato que esta função já esperava (verificado
 * campo a campo na reconciliação final do épico).
 */
export async function completeInviteSignup(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  const response = await apiFetch(AUTH_INVITE_COMPLETE_PATH, {
    method: 'POST',
    body: JSON.stringify({ email, code, new_password: newPassword }),
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as Partial<{
      error: CompleteInviteErrorCode
      message: string
    }>
    throw new CompleteInviteError(
      body.error ?? 'upstream_error',
      body.message ?? 'Não foi possível concluir seu cadastro. Tente novamente.',
    )
  }

  const data = (await response.json()) as SessionResponse
  await persistSessionResponse(data)
}

/**
 * Verifica se já existe uma sessão válida (cookie web / token mobile),
 * renovando-a no processo — usado no boot da tela de login para pular
 * direto para S1/dashboard quando o token já é válido (critério de aceite).
 * Retorna null se não há sessão válida.
 */
export async function checkExistingSession(): Promise<LoginResult | null> {
  const data = await callRefreshEndpoint()
  if (!data) return null
  await persistSessionResponse(data)
  return { ok: true, memberships: data.memberships ?? [] }
}

/** POST /auth/logout — sempre trata como sucesso do ponto de vista da UI;
 * quem chama (BEAC-1794) ainda limpa o secure storage e cache local,
 * independente do resultado da chamada de rede. */
export async function logout(): Promise<void> {
  await apiFetch(AUTH_LOGOUT_PATH, { method: 'POST' })
}
