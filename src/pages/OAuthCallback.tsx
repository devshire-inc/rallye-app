import { useEffect } from 'react'

export interface OAuthCallbackProps {
  /** Injetável para testes; default lê window.location.search. */
  search?: string
  /** Injetável para testes; default é window.location.assign. */
  navigate?: (path: string) => void
}

// Rota mantida apenas por segurança/retrocompatibilidade (BEAC-1816,
// correção de arquitetura) — ex.: um link/bookmark antigo apontando para cá
// durante a janela de deploy da mudança. NÃO faz mais nenhuma troca de
// código: o backend (GET /auth/oauth/callback, BEAC-1815) já faz isso
// sozinho e redireciona direto para /dashboard (sucesso) ou
// /login?oauth_error=...&provider=... (falha). Esta página só repassa a
// query string para /login, que é quem sabe ler oauth_error/provider e
// exibir o toast (ver LoginPage.tsx).
export function OAuthCallback({ search, navigate }: OAuthCallbackProps = {}) {
  useEffect(() => {
    const doNavigate = navigate ?? ((path: string) => window.location.assign(path))
    const query = search ?? window.location.search
    doNavigate(`/login${query}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
