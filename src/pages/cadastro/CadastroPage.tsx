import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatBRPhoneInput } from '../../lib/phone'
import {
  getSignupFieldErrors,
  type SignupFieldErrors,
  type SignupFormValues,
} from '../../lib/validation/signupSchema'
import { signup } from '../../lib/api/signup'
import { setPendingVerification } from '../../lib/pendingVerification'
import './CadastroPage.css'

type FieldName = keyof SignupFormValues

const emptyValues: SignupFormValues = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
}

/**
 * A2 — Cadastro de Conta. Formulário controlado com validação inline (zod) e
 * máscara de telefone BR. Google/Apple ficam presentes no layout mas sem
 * lógica de OAuth (BEAC-1809, outra story) — não pedimos esporte/nível aqui
 * (isso é feito depois pelo Admin) e a tela é acessível sem nenhum papel
 * (pré-RBAC).
 */
export function CadastroPage() {
  const navigate = useNavigate()
  const [values, setValues] = useState<SignupFormValues>(emptyValues)
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({})
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [emailAlreadyRegistered, setEmailAlreadyRegistered] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const fieldErrors: SignupFieldErrors = getSignupFieldErrors(values)
  const isValid = Object.keys(fieldErrors).length === 0
  const passwordLongEnough = values.password.length >= 8

  function updateField(field: FieldName, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }))
    setEmailAlreadyRegistered(false)
    setSubmitError(null)
  }

  function markTouched(field: FieldName) {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  function errorFor(field: FieldName): string | undefined {
    return touched[field] ? fieldErrors[field] : undefined
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setTouched({ fullName: true, email: true, phone: true, password: true, confirmPassword: true })

    if (!isValid) return

    setSubmitting(true)
    setSubmitError(null)
    setEmailAlreadyRegistered(false)

    const result = await signup(values)

    setSubmitting(false)

    if (result.ok) {
      setPendingVerification({ userId: result.userId, email: values.email })
      navigate('/verify-email')
      return
    }

    if (result.error === 'email_already_registered') {
      setEmailAlreadyRegistered(true)
      return
    }

    setSubmitError('Não foi possível concluir o cadastro. Tente novamente.')
  }

  return (
    <section className="cadastro-page" aria-labelledby="cadastro-title">
      <h1 id="cadastro-title">Criar conta</h1>

      <div className="oauth-buttons">
        <button
          type="button"
          className="oauth-button"
          disabled
          title="Login social em breve (BEAC-1809)"
        >
          Continuar com Google
        </button>
        <button
          type="button"
          className="oauth-button"
          disabled
          title="Login social em breve (BEAC-1809)"
        >
          Continuar com Apple
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="fullName">Nome completo</label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            value={values.fullName}
            onChange={(e) => updateField('fullName', e.target.value)}
            onBlur={() => markTouched('fullName')}
            aria-invalid={Boolean(errorFor('fullName'))}
            aria-describedby="fullName-error"
          />
          {errorFor('fullName') && (
            <p id="fullName-error" className="field-error" role="alert">
              {errorFor('fullName')}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(e) => updateField('email', e.target.value)}
            onBlur={() => markTouched('email')}
            aria-invalid={Boolean(errorFor('email'))}
            aria-describedby="email-error"
          />
          {errorFor('email') && (
            <p id="email-error" className="field-error" role="alert">
              {errorFor('email')}
            </p>
          )}
          {emailAlreadyRegistered && (
            <p className="field-error" role="alert">
              Este email já está cadastrado. <Link to="/login">Fazer login?</Link>
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="phone">Telefone/WhatsApp</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="(XX) XXXXX-XXXX"
            value={values.phone}
            onChange={(e) => updateField('phone', formatBRPhoneInput(e.target.value))}
            onBlur={() => markTouched('phone')}
            aria-invalid={Boolean(errorFor('phone'))}
            aria-describedby="phone-error"
          />
          {errorFor('phone') && (
            <p id="phone-error" className="field-error" role="alert">
              {errorFor('phone')}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="password">Senha</label>
          <div className="password-input">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={values.password}
              onChange={(e) => updateField('password', e.target.value)}
              onBlur={() => markTouched('password')}
              aria-invalid={Boolean(errorFor('password'))}
              aria-describedby="password-hint"
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          <p
            id="password-hint"
            className={passwordLongEnough ? 'field-hint field-hint--ok' : 'field-hint'}
          >
            {passwordLongEnough ? '✓ Mínimo de 8 caracteres' : 'Mínimo de 8 caracteres'}
          </p>
        </div>

        <div className="field">
          <label htmlFor="confirmPassword">Confirmar senha</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={(e) => updateField('confirmPassword', e.target.value)}
            onBlur={() => markTouched('confirmPassword')}
            aria-invalid={Boolean(errorFor('confirmPassword'))}
            aria-describedby="confirmPassword-error"
          />
          {errorFor('confirmPassword') && (
            <p id="confirmPassword-error" className="field-error" role="alert">
              {errorFor('confirmPassword')}
            </p>
          )}
        </div>

        {submitError && (
          <p className="field-error" role="alert">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          className="submit-button"
          disabled={!isValid || submitting}
          style={{ opacity: !isValid || submitting ? 0.5 : 1 }}
        >
          {submitting ? 'Criando conta…' : 'CRIAR MINHA CONTA'}
        </button>
      </form>
    </section>
  )
}

export default CadastroPage
