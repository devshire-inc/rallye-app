// Login social (Google/Apple) — BEAC-1809/BEAC-1816.
//
// Decisão técnica (correção de arquitetura, ver PR): a versão anterior deste
// arquivo construía a URL de autorização do Supabase diretamente no frontend
// (gerando PKCE aqui, com a anon key como query param) — uma exceção não
// aprovada à locked decision "BFF total". A decisão do usuário foi remover a
// exceção: agora o frontend não fala com o Supabase em NENHUM momento, nem
// para esse hop de redirect. Toda a lógica de PKCE/state/troca de código foi
// movida para o backend (rallye-api, GET /auth/oauth/authorize e
// GET /auth/oauth/callback — ver BEAC-1815).
//
// O botão de login social agora faz uma única navegação de página inteira
// (nunca fetch/XHR) para GET {API_BASE_URL}/auth/oauth/authorize?provider=...
// no próprio BFF. O backend cuida do resto do fluxo e, ao final, redireciona
// o browser direto para /dashboard (sucesso) ou /login?oauth_error=...
// (falha) — não há mais nenhum passo de troca de código para o frontend
// executar.

export type OAuthProvider = 'google' | 'apple'

/** Monta a URL do endpoint de authorize deste próprio backend (pure function, TDD). */
export function buildAuthorizeUrl(apiBaseUrl: string, provider: OAuthProvider): string {
  return `${apiBaseUrl.replace(/\/$/, '')}/auth/oauth/authorize?provider=${provider}`
}

/**
 * Inicia o fluxo OAuth2: uma única navegação de página inteira para o
 * endpoint de authorize do BFF. `navigate` é injetável para testes (padrão
 * default = window.location.assign).
 */
export function startOAuthLogin(
  provider: OAuthProvider,
  apiBaseUrl: string,
  navigate: (url: string) => void = (url) => {
    window.location.assign(url)
  },
): void {
  navigate(buildAuthorizeUrl(apiBaseUrl, provider))
}
