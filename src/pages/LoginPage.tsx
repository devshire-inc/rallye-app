import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout/AuthLayout'
import { Toast } from '../components/Toast'
import { AuthDivider } from '../components/ui/AuthDivider/AuthDivider'
import { Button } from '../components/ui/Button/Button'
import { Input } from '../components/ui/Input/Input'
import { PageLoading } from '../components/ui/PageLoading/PageLoading'
import { PasswordInput } from '../components/ui/PasswordInput/PasswordInput'
import { SocialAuthButton } from '../components/ui/SocialAuthButton/SocialAuthButton'
import { useToast } from '../hooks/useToast'
import { checkExistingSession, login } from '../lib/httpClient'
import { startOAuthLogin, type OAuthProvider } from '../lib/oauth'
import { redirectPathForMemberships } from '../lib/redirectTarget'

const GENERIC_ERROR_MESSAGE = 'credenciais inválidas'

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

/**
 * Tela de login (BEAC-1793): e-mail/senha, social login (BEAC-1809/1816) e o
 * critério de "sessão já válida pula o login".
 *
 * Decisão técnica (correção de arquitetura, BEAC-1815/1816): desde que o
 * fluxo OAuth passou a ser inteiramente conduzido pelo backend (GET
 * /auth/oauth/authorize + GET /auth/oauth/callback), qualquer falha do lado
 * do provider/Supabase é sinalizada por um redirect HTTP do próprio backend
 * de volta para cá, com `?oauth_error=<motivo>&provider=<google|apple>` na
 * query string — não mais por uma chamada JS que esta página faça. Por isso
 * é aqui, e não mais em uma rota de callback separada, que o toast de falha
 * é lido e exibido.
 */
export default function LoginPage({ searchParams }: LoginPageProps = {}) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const { message, showError, dismiss } = useToast()

  useEffect(() => {
    let cancelled = false

    checkExistingSession().then((result) => {
      if (cancelled) return
      if (result) {
        navigate(redirectPathForMemberships(result.memberships), { replace: true })
        return
      }
      setCheckingSession(false)
    })

    return () => {
      cancelled = true
    }
  }, [navigate])

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await login(email, password)
      if (!result.ok) {
        setError(GENERIC_ERROR_MESSAGE)
        return
      }
      navigate(redirectPathForMemberships(result.memberships), { replace: true })
    } finally {
      setSubmitting(false)
    }
  }

  function handleSocialLogin(provider: OAuthProvider) {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined
    if (!apiBaseUrl) {
      showError(toastMessageFor(provider))
      return
    }
    startOAuthLogin(provider, apiBaseUrl)
  }

  // Enquanto a sessão existente é checada, o AuthLayout inteiro continua na
  // tela (marca, hero, painel do formulário) e só o miolo vira skeleton —
  // antes esta tela descartava a shell e renderizava "Carregando…" solto no
  // canto superior esquerdo (Figma node 187:7216).
  const formPanel = (
    <>
      <form onSubmit={handleSubmit} className="stack">
        <Input
          id="email"
          name="email"
          type="email"
          label="E-mail"
          autoComplete="email"
          required
          placeholder="voce@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div>
          <PasswordInput
            id="password"
            name="password"
            label="Senha"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Link to="/esqueci-senha" className="link-inline">
              Esqueci minha senha
            </Link>
          </div>
        </div>

        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}

        {/* `loading` (não `disabled` + troca de rótulo): o estado Loading do
            Button já desabilita nativamente, marca aria-busy e troca o ícone
            pelo spinner animado — mesma convenção de AgendarConfirmarPage e
            OfferSheet. O rótulo fica "Entrar" e só esmaece: com o spinner ao
            lado, um "Entrando…" seria a mesma informação duas vezes (e ainda
            faria o rótulo mudar de largura no meio do submit). */}
        <Button type="submit" size="lg" fullWidth loading={submitting}>
          Entrar
        </Button>
      </form>

      <AuthDivider label="ou" />

      <SocialAuthButton
        style="outline"
        logo="google"
        label="Continuar com Google"
        onClick={() => handleSocialLogin('google')}
      />

      <div className="footer-link">
        Novo por aqui? <Link to="/cadastro">Criar conta</Link>
      </div>
    </>
  )

  return (
    <main aria-busy={checkingSession || undefined}>
      <AuthLayout
        hero
        heroTitle="Bora pra quadra!"
        heroSubtitle="Suas aulas e reservas te esperando."
        title="Entrar"
        hint={
          checkingSession ? undefined : (
            <>
              5 tentativas erradas bloqueiam por 15 min · login social vincula conta existente com
              o mesmo e-mail.
            </>
          )
        }
      >
        {checkingSession ? (
          <PageLoading label="Carregando" variant="section" rows={1} />
        ) : (
          formPanel
        )}
      </AuthLayout>

      <Toast message={message} onDismiss={dismiss} />
    </main>
  )
}
