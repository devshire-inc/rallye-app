import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { confirmPasswordReset, PasswordResetApiError } from '../lib/passwordReset'
import { useToast } from '../hooks/useToast'
import { Toast } from '../components/Toast'

const MIN_PASSWORD_LENGTH = 8

type FieldErrors = {
  code?: string
  newPassword?: string
  confirmPassword?: string
}

/**
 * A3 etapa 2 — código + nova senha (BEAC-1798).
 *
 * Máximo de 3 tentativas de código incorreto: quando o backend responde
 * `too_many_attempts` ou `code_expired`, a tela força o reinício da etapa 1
 * via link — não há retry local possível a partir daqui.
 */
export function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { toast, showToast } = useToast()

  const emailFromQuery = searchParams.get('email') ?? ''
  const [email, setEmail] = useState(emailFromQuery)
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [mustRestart, setMustRestart] = useState(false)
  const [restartMessage, setRestartMessage] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  function validate(): FieldErrors {
    const errors: FieldErrors = {}
    if (!/^\d{6}$/.test(code)) {
      errors.code = 'Informe os 6 dígitos do código recebido por e-mail.'
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      errors.newPassword = `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`
    }
    if (newPassword !== confirmPassword) {
      errors.confirmPassword = 'As senhas não coincidem.'
    }
    return errors
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setServerError(null)

    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      const result = await confirmPasswordReset({ email: email.trim(), code, newPassword })
      showToast('Senha redefinida!')
      setSubmitting(false)
      setTimeout(() => navigate('/'), 1200)
      void result
    } catch (err) {
      setSubmitting(false)
      if (err instanceof PasswordResetApiError) {
        if (err.code === 'too_many_attempts') {
          setMustRestart(true)
          setRestartMessage('Muitas tentativas. Solicite um novo código.')
          return
        }
        if (err.code === 'code_expired') {
          setMustRestart(true)
          setRestartMessage('Link expirado. Solicite um novo código.')
          return
        }
        if (err.code === 'invalid_code') {
          setServerError('Código inválido ou expirado.')
          return
        }
        setServerError(err.message)
        return
      }
      setServerError('Não foi possível redefinir sua senha. Tente novamente.')
    }
  }

  if (mustRestart) {
    return (
      <section aria-labelledby="reset-password-title">
        <h1 id="reset-password-title">Redefinir senha</h1>
        <p role="alert">{restartMessage}</p>
        <p>
          <Link to="/esqueci-senha">Solicitar novo código</Link>
        </p>
      </section>
    )
  }

  return (
    <section aria-labelledby="reset-password-title">
      <h1 id="reset-password-title">Redefinir senha</h1>
      <Toast toast={toast} />
      <form onSubmit={handleSubmit} noValidate>
        {!emailFromQuery && (
          <>
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </>
        )}
        {emailFromQuery && <p>Código enviado para: {emailFromQuery}</p>}

        <label htmlFor="code">Código</label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          required
        />
        {fieldErrors.code && (
          <p role="alert" className="error">
            {fieldErrors.code}
          </p>
        )}

        <label htmlFor="new-password">Nova senha</label>
        <input
          id="new-password"
          name="new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        {fieldErrors.newPassword && (
          <p role="alert" className="error">
            {fieldErrors.newPassword}
          </p>
        )}

        <label htmlFor="confirm-password">Confirmar senha</label>
        <input
          id="confirm-password"
          name="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        {fieldErrors.confirmPassword && (
          <p role="alert" className="error">
            {fieldErrors.confirmPassword}
          </p>
        )}

        {serverError && (
          <p role="alert" className="error">
            {serverError}
          </p>
        )}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Redefinindo...' : 'Redefinir senha'}
        </button>
      </form>
    </section>
  )
}
