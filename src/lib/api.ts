// Cliente HTTP da rallye-api (BFF). Padrão travado do projeto: o rallye-app
// nunca fala com o Supabase diretamente, só com a rallye-api.
import { apiFetch } from './httpClient'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export type VerifyEmailErrorCode =
  | 'code_not_found'
  | 'code_expired'
  | 'invalid_code'
  | 'too_many_attempts'
  | 'locked'
  | 'missing_fields'
  | 'internal_error'

export class VerifyEmailError extends Error {
  code: VerifyEmailErrorCode
  constructor(code: VerifyEmailErrorCode) {
    super(`verify-email failed: ${code}`)
    this.code = code
  }
}

/** POST /auth/verify-email (BEAC-1810). Throws VerifyEmailError on failure. */
export async function verifyEmail(userId: string, code: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, code }),
  })
  if (res.ok) return
  throw new VerifyEmailError(await errorCode(res))
}

export type ResendVerificationErrorCode = 'too_many_resends' | 'missing_fields' | 'internal_error'

export class ResendVerificationError extends Error {
  code: ResendVerificationErrorCode
  constructor(code: ResendVerificationErrorCode) {
    super(`verify-email/resend failed: ${code}`)
    this.code = code
  }
}

/** POST /auth/verify-email/resend (BEAC-1811). Throws ResendVerificationError on failure. */
export async function resendVerification(userId: string, email: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/auth/verify-email/resend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, email }),
  })
  if (res.ok) return
  throw new ResendVerificationError(await errorCode(res))
}

export type VisitorRequestErrorCode = 'too_many_resends' | 'missing_fields' | 'internal_error'

export class VisitorRequestError extends Error {
  code: VisitorRequestErrorCode
  constructor(code: VisitorRequestErrorCode) {
    super(`visitor/request failed: ${code}`)
    this.code = code
  }
}

export type VisitorRequestResult = {
  /** true quando o e-mail já tem conta completa — nenhum código foi enviado. */
  accountExists: boolean
  sent: boolean
}

/**
 * POST /auth/visitor/request (BEAC-1819, tela A5 etapa 1). Se o e-mail já
 * tiver uma conta completa, o back-end sinaliza account_exists=true em vez
 * de enviar um código — a tela sugere login (A1) nesse caso.
 */
export async function requestVisitorCode(
  email: string,
  tournamentId: string,
): Promise<VisitorRequestResult> {
  const res = await fetch(`${API_BASE_URL}/auth/visitor/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, tournament_id: tournamentId }),
  })
  if (res.status === 429) throw new VisitorRequestError('too_many_resends')
  if (!res.ok) throw new VisitorRequestError(await errorCode(res))
  const body = (await res.json()) as { account_exists: boolean; sent: boolean }
  return { accountExists: body.account_exists, sent: body.sent }
}

export type VisitorVerifyErrorCode = 'invalid_code' | 'missing_fields' | 'internal_error'

export class VisitorVerifyError extends Error {
  code: VisitorVerifyErrorCode
  constructor(code: VisitorVerifyErrorCode) {
    super(`visitor/verify failed: ${code}`)
    this.code = code
  }
}

export type VisitorSessionResult = {
  type: 'temporary'
  scope: string
  expiresAt: string
}

/**
 * POST /auth/visitor/verify (BEAC-1820, tela A5 etapa 2). Em caso de
 * sucesso o BFF já seta o cookie `rallye_session` (credentials: 'include' é
 * obrigatório para o navegador aceitar/enviar esse cookie) — a sessão
 * temporária resultante nunca carrega memberships reais.
 */
export async function verifyVisitorCode(
  email: string,
  tournamentId: string,
  code: string,
): Promise<VisitorSessionResult> {
  const res = await fetch(`${API_BASE_URL}/auth/visitor/verify`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, tournament_id: tournamentId, code }),
  })
  if (res.status === 401) throw new VisitorVerifyError('invalid_code')
  if (!res.ok) throw new VisitorVerifyError(await errorCode(res))
  const body = (await res.json()) as { type: 'temporary'; scope: string; expires_at: string }
  return { type: body.type, scope: body.scope, expiresAt: body.expires_at }
}

export type RedeemInviteErrorCode =
  'invite_not_found' | 'invite_expired' | 'already_member' | 'internal_error'

export class RedeemInviteError extends Error {
  code: RedeemInviteErrorCode
  constructor(code: RedeemInviteErrorCode) {
    super(`invites/redeem failed: ${code}`)
    this.code = code
  }
}

export type RedeemInviteResult = {
  unitId: string
  roleId: string
}

/**
 * POST /invites/{code}/redeem (BEAC-1807, consumido pelo bottom sheet
 * BEAC-1808). `already_member` (409) é tratado pela UI como informação, não
 * erro — ver EnterArenaSheet, que o renderiza com um tom neutro, não
 * vermelho.
 */
export async function redeemInvite(code: string): Promise<RedeemInviteResult> {
  const res = await fetch(`${API_BASE_URL}/invites/${encodeURIComponent(code)}/redeem`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) throw new RedeemInviteError(await errorCode(res))
  const body = (await res.json()) as { unit_id: string; role_id: string }
  return { unitId: body.unit_id, roleId: body.role_id }
}

async function errorCode<T extends string>(res: Response): Promise<T> {
  try {
    const body = (await res.json()) as { error?: string }
    return (body.error as T) ?? ('internal_error' as T)
  } catch {
    return 'internal_error' as T
  }
}

export interface MembershipUnit {
  name: string
  /** `public.units` só tem um campo `address` livre — sem colunas
   * separadas de cidade/estado (gap de dado já documentado em
   * api/internal/memberships/handler.go, BEAC-1834). Exibido como veio. */
  address: string | null
  /** Array de slugs (ex.: `["beach_tennis","padel"]`) — ver `lib/sports.ts`
   * para o catálogo slug→rótulo/cor conhecido. `unknown` porque
   * `sports_offered` é JSONB de estrutura livre no banco (comentário da
   * migration 000005) — validamos o shape só na hora de renderizar. */
  sportsOffered: unknown
}

export interface MembershipListItem {
  unitId: string
  unit: MembershipUnit
  /** null quando a membership ainda não tem role atribuído (RBAC é do
   * Épico 3) — ver comentário de membershipListItem em handler.go. */
  role: string | null
  lastAccessedAt: string | null
  /** Sempre null hoje — indicador de atividade ao vivo é do Épico 6 (ver
   * handler.go). Mantido no shape para não quebrar quando existir. */
  liveActivity: string | null
}

export class ListMembershipsError extends Error {
  constructor() {
    super('me/memberships failed')
  }
}

type MembershipListItemWire = {
  unit_id: string
  unit: { name: string; address: string | null; sports_offered?: unknown }
  role: string | null
  last_accessed_at: string | null
  live_activity: string | null
}

/**
 * GET /me/memberships (BEAC-1834), consumido pela tela real S1 (BEAC-1835).
 * Usa `apiFetch` (não `fetch` cru como o resto deste módulo) porque este é
 * um endpoint autenticado self-access: `apiFetch` é o único ponto de
 * entrada HTTP documentado da app (ver httpClient.ts) — cookie web +
 * bearer token nativo + interceptor de refresh-on-401 de graça.
 */
export async function listMyMemberships(): Promise<MembershipListItem[]> {
  const res = await apiFetch('/me/memberships')
  if (!res.ok) throw new ListMembershipsError()
  const body = (await res.json()) as { memberships: MembershipListItemWire[] }
  return body.memberships.map((m) => ({
    unitId: m.unit_id,
    unit: {
      name: m.unit.name,
      address: m.unit.address,
      sportsOffered: m.unit.sports_offered ?? null,
    },
    role: m.role,
    lastAccessedAt: m.last_accessed_at,
    liveActivity: m.live_activity,
  }))
}

export class AccessMembershipError extends Error {
  constructor() {
    super('me/memberships/:unit_id/access failed')
  }
}

/**
 * POST /me/memberships/{unit_id}/access (BEAC-1834): marca "acessei essa
 * arena agora" (last_accessed_at = now()). Chamado pela S1 real ao entrar
 * numa arena (tap num card, ou pulo automático quando há só 1 membership).
 */
export async function accessMembership(unitId: string): Promise<void> {
  const res = await apiFetch(`/me/memberships/${encodeURIComponent(unitId)}/access`, {
    method: 'POST',
  })
  if (!res.ok) throw new AccessMembershipError()
}
