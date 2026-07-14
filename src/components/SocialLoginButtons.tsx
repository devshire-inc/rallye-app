import { startOAuthLogin, type OAuthProvider } from '../lib/oauth'
import './SocialLoginButtons.css'

export interface SocialLoginButtonsProps {
  /** Apple fica oculto (não desabilitado) até BEAC-1814 desbloquear o provider. */
  appleEnabled?: boolean
  onError: (message: string) => void
  /** Injetável para testes; default lê import.meta.env. */
  navigate?: (url: string) => void
}

const PROVIDER_LABEL: Record<OAuthProvider, string> = {
  google: 'Google',
  apple: 'Apple',
}

function toastMessageFor(provider: OAuthProvider): string {
  // Texto exato do doc A1.
  return `Não foi possível conectar com ${PROVIDER_LABEL[provider]}. Tente novamente.`
}

export function SocialLoginButtons({
  appleEnabled = false,
  onError,
  navigate,
}: SocialLoginButtonsProps) {
  const handleClick = async (provider: OAuthProvider) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

    if (!supabaseUrl || !supabaseAnonKey) {
      onError(toastMessageFor(provider))
      return
    }

    try {
      await startOAuthLogin(
        provider,
        {
          supabaseUrl,
          supabaseAnonKey,
          redirectTo: `${window.location.origin}/oauth/callback`,
        },
        navigate,
      )
    } catch {
      onError(toastMessageFor(provider))
    }
  }

  return (
    <div className="social-login-buttons">
      <button
        type="button"
        className="social-login-button social-login-button--google"
        onClick={() => void handleClick('google')}
      >
        <svg className="social-login-button__icon" role="presentation" aria-hidden="true">
          <use href="/icons.svg#google-icon"></use>
        </svg>
        <span>Continuar com Google</span>
      </button>

      {appleEnabled && (
        <button
          type="button"
          className="social-login-button social-login-button--apple"
          onClick={() => void handleClick('apple')}
        >
          <svg className="social-login-button__icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#apple-icon"></use>
          </svg>
          <span>Continuar com Apple</span>
        </button>
      )}
    </div>
  )
}
