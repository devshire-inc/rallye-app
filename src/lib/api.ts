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
export async function resendVerification(userId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/auth/verify-email/resend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  })
  if (res.ok) return
  throw new ResendVerificationError(await errorCode(res))
}

async function errorCode<T extends string>(res: Response): Promise<T> {
  try {
    const body = (await res.json()) as { error?: string }
    return (body.error as T) ?? ('internal_error' as T)
  } catch {
    return 'internal_error' as T
  }
}
