// Cliente HTTP de POST /auth/signup (BFF, rallye-api). O rallye-app nunca
// fala direto com o Supabase — sempre via rallye-api (padrão BFF, decisão
// travada). credentials: 'include' é necessário para o navegador aceitar o
// cookie rallye_session (HttpOnly+Secure) emitido pela resposta.

export interface SignupPayload {
  fullName: string
  email: string
  phone: string
  password: string
}

export interface SignupSuccess {
  ok: true
  userId: string
  sessionToken: string
}

export interface SignupFailure {
  ok: false
  status: number
  error: string
  fields?: Record<string, string>
}

export type SignupResponse = SignupSuccess | SignupFailure

function apiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'
}

export async function signup(payload: SignupPayload): Promise<SignupResponse> {
  const response = await fetch(`${apiBaseUrl()}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      full_name: payload.fullName,
      email: payload.email,
      phone: payload.phone,
      password: payload.password,
    }),
  })

  const body = await response.json().catch(() => ({}))

  if (response.ok) {
    return { ok: true, userId: body.user_id, sessionToken: body.session_token }
  }

  return {
    ok: false,
    status: response.status,
    error: body.error ?? 'unknown_error',
    fields: body.fields,
  }
}
