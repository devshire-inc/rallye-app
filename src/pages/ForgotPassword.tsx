import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout/AuthLayout'
import { Button } from '../components/ui/Button/Button'
import { Input } from '../components/ui/Input/Input'
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
        <AuthLayout
          cornerMark
          mark="none"
          title={<span id="forgot-password-title">Esqueci minha senha</span>}
          subtitle="Etapa 1 de 2 — informe seu e-mail e enviamos um código de redefinição."
        >
          <p role="status" className="section-desc">
            {message}
          </p>
          <p className="footer-link">
            <Link to={`/redefinir-senha?email=${encodeURIComponent(email.trim())}`}>
              Já tenho um código
            </Link>
          </p>
        </AuthLayout>
      </section>
    )
  }

  return (
    <section aria-labelledby="forgot-password-title">
      <AuthLayout
        cornerMark
        mark="none"
        title={<span id="forgot-password-title">Esqueci minha senha</span>}
        subtitle="Etapa 1 de 2 — informe seu e-mail e enviamos um código de redefinição."
        hint="Máx. 3 códigos errados bloqueiam o pedido."
      >
        <form onSubmit={handleSubmit} noValidate className="stack">
          <Input
            id="email"
            name="email"
            type="email"
            label="E-mail"
            placeholder="voce@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === 'submitting'}
            required
          />

          {status === 'rate_limited' && (
            <p role="alert" className="field-error">
              {message ?? RATE_LIMIT_MESSAGE}
            </p>
          )}
          {status === 'validation_error' && (
            <p role="alert" className="field-error">
              {message}
            </p>
          )}

          <Button type="submit" fullWidth disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Enviando...' : 'Enviar código'}
          </Button>
        </form>
        <p className="footer-link">
          <Link to="/">Voltar para o login</Link>
        </p>
      </AuthLayout>
    </section>
  )
}
