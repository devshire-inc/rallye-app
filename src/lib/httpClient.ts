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
import { type Membership, setSessionMemberships } from './tenantContext'

export const SESSION_EXPIRED_EVENT = 'rallye:session-expired'
/**
 * Disparado sempre que uma sessão (memberships) é persistida com sucesso —
 * login e checkExistingSession (refresh no boot), ver persistSessionResponse
 * abaixo. PermissionsContext (BEAC-1841) escuta este evento para buscar
 * GET /me/permissions assim que uma sessão fica disponível, sem acoplar
 * este módulo (livre de React) a nenhum contexto/estado de UI — mesmo
 * padrão já usado por SESSION_EXPIRED_EVENT/App.tsx.
 */
export const SESSION_ESTABLISHED_EVENT = 'rallye:session-established'

const AUTH_LOGIN_PATH = '/auth/login'
const AUTH_REFRESH_PATH = '/auth/refresh'
const AUTH_LOGOUT_PATH = '/auth/logout'

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

async function buildHeaders(init?: RequestInit): Promise<Headers> {
  const headers = new Headers(init?.headers)
  if (isNativePlatform()) {
    const token = await getSessionToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
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

  const isAuthEndpoint = path === AUTH_LOGIN_PATH || path === AUTH_REFRESH_PATH
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
