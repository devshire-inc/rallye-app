import { useEffect } from 'react'
import { SocialLoginButtons } from '../components/SocialLoginButtons'
import { Toast } from '../components/Toast'
import { useToast } from '../hooks/useToast'
import type { OAuthProvider } from '../lib/oauth'

const PROVIDER_LABEL: Record<OAuthProvider, string> = {
  google: 'Google',
  apple: 'Apple',
}

function toastMessageFor(provider: OAuthProvider): string {
  // Texto exato do doc A1.
  return `Não foi possível conectar com ${PROVIDER_LABEL[provider]}. Tente novamente.`
}

export interface LoginPageProps {
  /** Injetável para testes; default lê window.location.search. */
  searchParams?: URLSearchParams
}

// A1 — Login. BEAC-1816: por enquanto esta é a única tela de login do
// worktree (BEAC-1674 constrói o restante do formulário de login em um
// worktree isolado em paralelo) — os botões sociais são adicionados aqui
// como o "login/signup component atualmente existente"; a reconciliação
// visual completa de A1 acontece na hora do merge das branches.
//
// Decisão técnica (correção de arquitetura, BEAC-1815/1816): desde que o
// fluxo OAuth passou a ser inteiramente conduzido pelo backend (GET
// /auth/oauth/authorize + GET /auth/oauth/callback), qualquer falha do lado
// do provider/Supabase é sinalizada por um redirect HTTP do próprio backend
// de volta para cá, com `?oauth_error=<motivo>&provider=<google|apple>` na
// query string — não mais por uma chamada JS que esta página faça. Por isso
// é aqui, e não mais em uma rota de callback separada, que o toast de falha
// é lido e exibido.
export function LoginPage({ searchParams }: LoginPageProps = {}) {
  const { message, showError, dismiss } = useToast()

  useEffect(() => {
    const params = searchParams ?? new URLSearchParams(window.location.search)
    const oauthError = params.get('oauth_error')
    if (!oauthError) return

    // provider pode vir ausente (ver comentário no backend, handler.go) —
    // nesse caso assumimos Google, único provider habilitado por enquanto.
    const providerParam = params.get('provider')
    const provider: OAuthProvider = providerParam === 'apple' ? 'apple' : 'google'
    showError(toastMessageFor(provider))

    if (!searchParams) {
      // Limpa a URL para não reexibir o toast num refresh ou navegação de volta.
      window.history.replaceState({}, '', window.location.pathname)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="auth-page" aria-label="Login">
      <h1>Entrar</h1>
      <SocialLoginButtons appleEnabled={false} onError={showError} />
      <Toast message={message} onDismiss={dismiss} />
    </main>
  )
}
