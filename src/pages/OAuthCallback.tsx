import { useEffect, useState } from 'react'
import { completeOAuthLogin, getStoredProvider, type OAuthProvider } from '../lib/oauth'
import { Toast } from '../components/Toast'

const PROVIDER_LABEL: Record<OAuthProvider, string> = {
  google: 'Google',
  apple: 'Apple',
}

export interface OAuthCallbackProps {
  code: string | null
  fetchImpl?: typeof fetch
  /** Injetável para testes; default é window.location.assign. */
  navigate?: (path: string) => void
}

function failureMessage(): string {
  const provider = getStoredProvider() ?? 'google'
  return `Não foi possível conectar com ${PROVIDER_LABEL[provider]}. Tente novamente.`
}

// Rota de retorno do provider OAuth (BEAC-1816). Em caso de sucesso navega
// direto para o Dashboard (S1) — nunca para a tela de verificação de e-mail
// (A4), conforme AC. Em caso de falha, exibe o toast com o texto exato do
// doc A1 e permanece na tela (sem navegar).
export function OAuthCallback({ code, fetchImpl, navigate }: OAuthCallbackProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(() =>
    code ? null : failureMessage(),
  )

  useEffect(() => {
    if (!code) {
      return
    }

    const doNavigate = navigate ?? ((path: string) => window.location.assign(path))
    const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

    let cancelled = false

    completeOAuthLogin(code, apiBaseUrl, fetchImpl).then((result) => {
      if (cancelled) return
      if (result.ok) {
        doNavigate('/dashboard')
      } else {
        setErrorMessage(failureMessage())
      }
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  return (
    <main aria-label="Concluindo login">
      <Toast message={errorMessage} onDismiss={() => setErrorMessage(null)} />
    </main>
  )
}
