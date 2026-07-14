import { startOAuthLogin, type OAuthProvider } from '../lib/oauth'
import './SocialLoginButtons.css'

export interface SocialLoginButtonsProps {
  /** Apple fica oculto (não desabilitado) até BEAC-1814 desbloquear o provider. */
  appleEnabled?: boolean
  onError: (message: string) => void
  /** Injetável para testes; default é window.location.assign. */
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
  const handleClick = (provider: OAuthProvider) => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined

    if (!apiBaseUrl) {
      onError(toastMessageFor(provider))
      return
    }

    startOAuthLogin(provider, apiBaseUrl, navigate)
  }

  return (
    <div className="social-login-buttons">
      <button
        type="button"
        className="social-login-button social-login-button--google"
        onClick={() => handleClick('google')}
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
          onClick={() => handleClick('apple')}
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
