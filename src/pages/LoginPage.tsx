import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { checkExistingSession, login } from '../lib/httpClient'
import { redirectPathForMemberships } from '../lib/redirectTarget'

const GENERIC_ERROR_MESSAGE = 'credenciais inválidas'

/**
 * Tela de login (BEAC-1793): e-mail/senha, social login (botões — a lógica
 * OAuth em si é da story BEAC-1809, fora de escopo aqui) e o critério de
 * "sessão já válida pula o login".
 */
export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

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

  if (checkingSession) {
    return (
      <main aria-busy="true">
        <p>Carregando…</p>
      </main>
    )
  }

  return (
    <main>
      <h1>Entrar</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label htmlFor="password">Senha</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <p role="alert" className="login-error">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      <div className="social-login">
        {/* Lógica OAuth de fato é da story BEAC-1809 (paralela) — os botões
            existem aqui apenas para não quebrar o layout da tela. */}
        <button type="button" disabled>
          Continuar com Google
        </button>
        <button type="button" disabled>
          Continuar com Apple
        </button>
      </div>
    </main>
  )
}
