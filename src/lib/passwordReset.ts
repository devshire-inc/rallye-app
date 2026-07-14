// Cliente do fluxo de redefinição de senha (A3, etapas 1 e 2) contra o BFF
// (rallye-api). O frontend nunca fala com o Supabase diretamente.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export interface ApiErrorBody {
  error: string
  message: string
}

export class PasswordResetApiError extends Error {
  code: string
  status: number

  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.code = body.error
    this.status = status
  }
}

async function postJSON<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = (await response.json().catch(() => ({}))) as Partial<ApiErrorBody> & Partial<T>

  if (!response.ok) {
    throw new PasswordResetApiError(response.status, {
      error: data.error ?? 'unknown_error',
      message: data.message ?? 'Ocorreu um erro. Tente novamente.',
    })
  }

  return data as T
}

export interface RequestResetResult {
  message: string
}

/** POST /auth/password/reset/request (A3 etapa 1, BEAC-1796). */
export function requestPasswordReset(email: string): Promise<RequestResetResult> {
  return postJSON<RequestResetResult>('/auth/password/reset/request', { email })
}

export interface ConfirmResetResult {
  message: string
}

export interface ConfirmResetInput {
  email: string
  code: string
  newPassword: string
}

/** POST /auth/password/reset/confirm (A3 etapa 2, BEAC-1823). */
export function confirmPasswordReset(input: ConfirmResetInput): Promise<ConfirmResetResult> {
  return postJSON<ConfirmResetResult>('/auth/password/reset/confirm', {
    email: input.email,
    code: input.code,
    new_password: input.newPassword,
  })
}
