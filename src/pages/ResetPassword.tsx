import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { confirmPasswordReset, PasswordResetApiError } from '../lib/passwordReset'
import { useToast } from '../hooks/useToast'
import { Toast } from '../components/Toast'
import { OtpInput } from '../components/OtpInput/OtpInput'
import { AuthLayout } from '../components/AuthLayout/AuthLayout'
import { AlertCard } from '../components/ui/AlertCard/AlertCard'
import { Button } from '../components/ui/Button/Button'
import { Input } from '../components/ui/Input/Input'
import { PasswordInput } from '../components/ui/PasswordInput/PasswordInput'

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
  const { message, showError, dismiss } = useToast()

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
      showError('Senha redefinida!')
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
        <AuthLayout
          onBack={() => navigate(-1)}
          heroTitle="Quase lá!"
          heroSubtitle="Só falta escolher sua nova senha."
          title={<span id="reset-password-title">Redefinir senha</span>}
        >
          <AlertCard tone="warning">
            <p role="alert">{restartMessage}</p>
            <Link to="/esqueci-senha" className="link-inline">
              Solicitar novo código →
            </Link>
          </AlertCard>
        </AuthLayout>
      </section>
    )
  }

  return (
    <section aria-labelledby="reset-password-title">
      <AuthLayout
        onBack={() => navigate(-1)}
        heroTitle="Quase lá!"
        heroSubtitle="Só falta escolher sua nova senha."
        title={<span id="reset-password-title">Redefinir senha</span>}
        subtitle="Etapa 2 de 2 — digite o código recebido e escolha uma nova senha."
        hint="O link/código expira em 1 hora."
      >
        <Toast message={message} onDismiss={dismiss} />
        <form onSubmit={handleSubmit} noValidate className="stack">
          {!emailFromQuery && (
            <Input
              id="email"
              name="email"
              type="email"
              label="E-mail"
              placeholder="voce@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          )}
          {emailFromQuery && <p className="section-desc">Código enviado para: {emailFromQuery}</p>}

          <div className="stack" style={{ gap: 8 }}>
            <span className="otp-label">Código</span>
            <OtpInput
              value={code}
              onChange={setCode}
              error={Boolean(fieldErrors.code)}
              disabled={submitting}
              autoFocus={false}
            />
            {fieldErrors.code && (
              <p role="alert" className="field-error">
                {fieldErrors.code}
              </p>
            )}
          </div>

          <PasswordInput
            id="new-password"
            name="new-password"
            label="Nova senha"
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            error={fieldErrors.newPassword}
            required
          />

          <PasswordInput
            id="confirm-password"
            name="confirm-password"
            label="Confirmar senha"
            placeholder="Repita a senha"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={fieldErrors.confirmPassword}
            required
          />

          {serverError && (
            <p role="alert" className="field-error">
              {serverError}
            </p>
          )}

          <Button type="submit" fullWidth disabled={submitting}>
            {submitting ? 'Redefinindo...' : 'Redefinir senha'}
          </Button>
        </form>
      </AuthLayout>
    </section>
  )
}
