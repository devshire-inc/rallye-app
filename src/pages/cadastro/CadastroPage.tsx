import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../../components/AuthLayout/AuthLayout'
import { AuthDivider } from '../../components/ui/AuthDivider/AuthDivider'
import { Button } from '../../components/ui/Button/Button'
import { Input } from '../../components/ui/Input/Input'
import { PasswordInput } from '../../components/ui/PasswordInput/PasswordInput'
import { SocialAuthButton } from '../../components/ui/SocialAuthButton/SocialAuthButton'
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
    <section className="cadastro-page" aria-label="Cadastro">
      <AuthLayout
        onBack={() => navigate(-1)}
        heroTitle="Crie sua conta"
        heroSubtitle="Uma conta só pra todas as arenas do Rallye."
        title="Criar sua conta"
        subtitle="Uma conta só para todas as arenas onde você joga. Esporte e nível a gente define depois."
        wide
        hint="Login social cria a conta na hora e pula a verificação de e-mail."
      >
        <div className="oauth-buttons">
          <SocialAuthButton
            style="outline"
            logo="google"
            label="Continuar com Google"
            disabled
            onClick={() => {}}
          />
          <SocialAuthButton
            style="light"
            logo="apple"
            label="Continuar com Apple"
            disabled
            onClick={() => {}}
          />
        </div>

        <AuthDivider label="ou preencha" />

        <form onSubmit={handleSubmit} className="stack" noValidate>
          <Input
            id="fullName"
            name="fullName"
            type="text"
            label="Nome completo"
            autoComplete="name"
            placeholder="Como te chamam na quadra?"
            value={values.fullName}
            onChange={(e) => updateField('fullName', e.target.value)}
            onBlur={() => markTouched('fullName')}
            error={errorFor('fullName')}
          />

          <div>
            <Input
              id="email"
              name="email"
              type="email"
              label="E-mail"
              autoComplete="email"
              placeholder="voce@email.com"
              value={values.email}
              onChange={(e) => updateField('email', e.target.value)}
              onBlur={() => markTouched('email')}
              error={errorFor('email')}
            />
            {emailAlreadyRegistered && (
              <p className="field-error" role="alert">
                Este email já está cadastrado. <Link to="/login">Fazer login?</Link>
              </p>
            )}
          </div>

          <Input
            id="phone"
            name="phone"
            type="tel"
            label="Telefone / WhatsApp"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="(XX) XXXXX-XXXX"
            value={values.phone}
            onChange={(e) => updateField('phone', formatBRPhoneInput(e.target.value))}
            onBlur={() => markTouched('phone')}
            error={errorFor('phone')}
          />

          <div>
            <PasswordInput
              id="password"
              name="password"
              label="Senha"
              autoComplete="new-password"
              value={values.password}
              onChange={(e) => updateField('password', e.target.value)}
              onBlur={() => markTouched('password')}
              error={errorFor('password')}
            />
            <p className={passwordLongEnough ? 'field-hint field-hint--ok' : 'field-hint'}>
              {passwordLongEnough ? '✓ Mínimo de 8 caracteres' : 'Mínimo de 8 caracteres'}
            </p>
          </div>

          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            label="Confirmar senha"
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={(e) => updateField('confirmPassword', e.target.value)}
            onBlur={() => markTouched('confirmPassword')}
            error={errorFor('confirmPassword')}
          />

          {submitError && (
            <p className="field-error" role="alert">
              {submitError}
            </p>
          )}

          <Button type="submit" size="lg" fullWidth disabled={!isValid || submitting}>
            {submitting ? 'Criando conta…' : 'Criar minha conta'}
          </Button>

          <div className="footer-link">
            Já tem conta? <Link to="/login">Entrar</Link>
          </div>
        </form>
      </AuthLayout>
    </section>
  )
}

export default CadastroPage
