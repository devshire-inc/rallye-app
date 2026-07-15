// Cliente HTTP da rallye-api (BFF). Padrão travado do projeto: o rallye-app
// nunca fala com o Supabase diretamente, só com a rallye-api.
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
export async function requestVisitorCode(email: string, tournamentId: string): Promise<VisitorRequestResult> {
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

async function errorCode<T extends string>(res: Response): Promise<T> {
  try {
    const body = (await res.json()) as { error?: string }
    return (body.error as T) ?? ('internal_error' as T)
  } catch {
    return 'internal_error' as T
  }
}
