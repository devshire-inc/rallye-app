import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PasswordResetApiError, requestPasswordReset } from '../lib/passwordReset'

type Status = 'idle' | 'submitting' | 'success' | 'rate_limited' | 'validation_error'

const RATE_LIMIT_MESSAGE = 'Muitas tentativas. Aguarde 5 minutos e tente novamente.'
const GENERIC_ERROR_MESSAGE = 'Não foi possível processar sua solicitação. Tente novamente.'

/**
 * A3 etapa 1 — "Esqueci minha senha" (BEAC-1797).
 *
 * Decisão travada (anti-enumeração, ver história): o doc original prevê um
 * estado distinto "Nenhuma conta com este e-mail" + link "Criar conta?".
 * Esse estado NÃO é implementado aqui — exista ou não a conta, a resposta do
 * backend (e desta tela) é sempre a mesma mensagem genérica de sucesso, para
 * nunca revelar se um e-mail está cadastrado. Apenas dois estados
 * visualmente distintos permanecem: sucesso (genérico) e rate limit.
 */
export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!email.trim()) {
      setStatus('validation_error')
      setMessage('Informe um e-mail.')
      return
    }

    setStatus('submitting')
    setMessage(null)

    try {
      const result = await requestPasswordReset(email.trim())
      setStatus('success')
      setMessage(result.message)
    } catch (err) {
      if (err instanceof PasswordResetApiError && err.code === 'rate_limited') {
        setStatus('rate_limited')
        setMessage(err.message || RATE_LIMIT_MESSAGE)
        return
      }
      if (err instanceof PasswordResetApiError && err.code === 'validation') {
        setStatus('validation_error')
        setMessage(err.message)
        return
      }
      setStatus('validation_error')
      setMessage(GENERIC_ERROR_MESSAGE)
    }
  }

  if (status === 'success') {
    return (
      <section aria-labelledby="forgot-password-title">
        <h1 id="forgot-password-title">Esqueci minha senha</h1>
        <p role="status">{message}</p>
        <p>
          <Link to={`/redefinir-senha?email=${encodeURIComponent(email.trim())}`}>
            Já tenho um código
          </Link>
        </p>
      </section>
    )
  }

  return (
    <section aria-labelledby="forgot-password-title">
      <h1 id="forgot-password-title">Esqueci minha senha</h1>
      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === 'submitting'}
          required
        />

        {status === 'rate_limited' && (
          <p role="alert" className="error">
            {message ?? RATE_LIMIT_MESSAGE}
          </p>
        )}
        {status === 'validation_error' && (
          <p role="alert" className="error">
            {message}
          </p>
        )}

        <button type="submit" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Enviando...' : 'Enviar código'}
        </button>
      </form>
      <p>
        <Link to="/">Voltar para o login</Link>
      </p>
    </section>
  )
}
