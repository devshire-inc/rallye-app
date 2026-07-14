// Login social (Google/Apple) — BEAC-1809/BEAC-1816.
//
// Decisão técnica (documentar no PR): a "locked decision" BFF total diz que
// todo tráfego de auth passa pela rallye-api, nunca frontend↔Supabase direto.
// A troca de código por sessão (que retorna tokens) respeita isso 100%: só
// acontece no backend, via POST /auth/oauth/callback (BEAC-1815) — o
// frontend nunca vê access_token/refresh_token do Supabase.
//
// O único contato do navegador com o domínio do Supabase é o *redirect*
// inicial para a tela de consentimento do provider (GET .../auth/v1/authorize),
// que é um endpoint público por design (o equivalente a redirecionar para a
// tela de login do Google/Apple diretamente) e não expõe nada sensível — a
// chave anônima (`VITE_SUPABASE_ANON_KEY`) é, por definição, segura para uso
// no cliente. Esse redirect é necessário porque é o próprio Supabase quem
// fala com o provider OAuth e decide o `code` de autorização; não há como
// proxyar esse hop pelo BFF sem reimplementar o dance OAuth do zero.
//
// Fluxo completo:
// 1. Usuário clica em "Google"/"Apple" -> startOAuthLogin gera um par PKCE,
//    guarda o code_verifier em sessionStorage e redireciona o navegador para
//    a URL de autorização do Supabase.
// 2. Supabase conduz o OAuth2 com o provider e redireciona de volta para
//    `redirectTo` (uma rota própria do app) com `?code=...`.
// 3. Essa rota (ver src/pages/OAuthCallback.tsx) lê o `code`, recupera o
//    code_verifier salvo, e chama completeOAuthLogin, que faz o POST para
//    o BFF (rallye-api) — daí em diante, tudo passa pelo backend.

export type OAuthProvider = 'google' | 'apple'

const PKCE_VERIFIER_STORAGE_KEY = 'rallye.oauth.code_verifier'
const PKCE_PROVIDER_STORAGE_KEY = 'rallye.oauth.provider'

export function isBase64Url(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value)
}

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const byte of arr) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Gera um code_verifier PKCE aleatório (RFC 7636), codificado em base64url. */
export function generateCodeVerifier(): string {
  const random = new Uint8Array(32)
  crypto.getRandomValues(random)
  return base64UrlEncode(random)
}

/** Deriva o code_challenge (S256) a partir de um code_verifier PKCE. */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return base64UrlEncode(digest)
}

interface BuildAuthorizeUrlParams {
  supabaseUrl: string
  anonKey: string
  provider: OAuthProvider
  redirectTo: string
  codeChallenge: string
}

/** Monta a URL pública de autorização OAuth do Supabase (pure function, TDD). */
export function buildAuthorizeUrl({
  supabaseUrl,
  anonKey,
  provider,
  redirectTo,
  codeChallenge,
}: BuildAuthorizeUrlParams): string {
  const url = new URL(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/authorize`)
  url.searchParams.set('provider', provider)
  url.searchParams.set('redirect_to', redirectTo)
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 's256')
  url.searchParams.set('apikey', anonKey)
  return url.toString()
}

export interface OAuthEnvConfig {
  supabaseUrl: string
  supabaseAnonKey: string
  redirectTo: string
}

/**
 * Inicia o fluxo OAuth2: gera PKCE, persiste o verifier e redireciona o
 * navegador para a tela de consentimento do provider via Supabase.
 *
 * `navigate` é injetável para permitir teste (padrão default = window.location.assign).
 */
export async function startOAuthLogin(
  provider: OAuthProvider,
  config: OAuthEnvConfig,
  navigate: (url: string) => void = (url) => {
    window.location.assign(url)
  },
): Promise<void> {
  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)

  sessionStorage.setItem(PKCE_VERIFIER_STORAGE_KEY, verifier)
  sessionStorage.setItem(PKCE_PROVIDER_STORAGE_KEY, provider)

  const url = buildAuthorizeUrl({
    supabaseUrl: config.supabaseUrl,
    anonKey: config.supabaseAnonKey,
    provider,
    redirectTo: config.redirectTo,
    codeChallenge: challenge,
  })

  navigate(url)
}

export interface CompleteOAuthLoginResult {
  ok: boolean
  status?: string
}

/**
 * Completa o fluxo: recupera o code_verifier salvo e faz o POST para o BFF
 * (rallye-api) trocar o código por sessão. Retorna { ok: false } em qualquer
 * falha (rede, provider, backend) — a tela chamadora decide o toast exato.
 */
export async function completeOAuthLogin(
  code: string,
  apiBaseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CompleteOAuthLoginResult> {
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_STORAGE_KEY)
  const provider = sessionStorage.getItem(PKCE_PROVIDER_STORAGE_KEY)

  if (!verifier || !provider) {
    return { ok: false }
  }

  try {
    const response = await fetchImpl(`${apiBaseUrl.replace(/\/$/, '')}/auth/oauth/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ code, code_verifier: verifier, provider }),
    })

    sessionStorage.removeItem(PKCE_VERIFIER_STORAGE_KEY)
    sessionStorage.removeItem(PKCE_PROVIDER_STORAGE_KEY)

    if (!response.ok) {
      return { ok: false }
    }

    const body = (await response.json()) as { status?: string }
    return { ok: true, status: body.status }
  } catch {
    return { ok: false }
  }
}

export function getStoredProvider(): OAuthProvider | null {
  const provider = sessionStorage.getItem(PKCE_PROVIDER_STORAGE_KEY)
  return provider === 'google' || provider === 'apple' ? provider : null
}
