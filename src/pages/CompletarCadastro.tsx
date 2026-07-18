import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout/AuthLayout'
import { CompleteInviteError, completeInviteSignup } from '../lib/httpClient'
import { requestPasswordReset, PasswordResetApiError } from '../lib/passwordReset'
import { RedeemInviteError, redeemInvite } from '../lib/api'

const MIN_PASSWORD_LENGTH = 8

type FieldErrors = {
  code?: string
  newPassword?: string
  confirmPassword?: string
}

type Phase =
  | 'missing_params'
  | 'sending_code'
  | 'send_failed'
  | 'code_sent'
  | 'confirming'
  | 'redeeming'
  | 'redeemed'

type RedeemFeedback = 'not_found' | 'expired' | 'already_member' | 'internal_error' | null

const REDEEM_MESSAGES: Record<Exclude<RedeemFeedback, null>, string> = {
  not_found: 'Código de convite não encontrado.',
  expired: 'O convite expirou. Peça um novo à sua arena.',
  already_member: 'Você já faz parte desta arena!',
  internal_error: 'Não foi possível concluir sua entrada na arena agora. Tente novamente.',
}

/**
 * Tela de completar cadastro via convite (BEAC-1860): o aluno chega aqui
 * pelo link enviado por BEAC-1858 (Admin cadastra aluno), que já criou a
 * conta no Supabase Auth (sem senha utilizável) + a linha em `students`
 * (status `pending`) + o convite em `invites` — mas NENHUMA membership
 * ainda (decisão travada desta story, resolvendo a ambiguidade original:
 * ver relatório de execução de BEAC-1860).
 *
 * Fluxo (adaptado de A3/Esqueci Senha, BEAC-1675, por decisão do
 * Orchestrator):
 *   1. Ao montar, dispara o mesmo envio de código de 6 dígitos do "Esqueci
 *      Senha" (requestPasswordReset, INALTERADO — mesma mecânica Supabase
 *      RequestRecovery, só reaproveitada num contexto diferente).
 *   2. O aluno digita o código + escolhe uma senha. Ao confirmar, chama
 *      completeInviteSignup (POST /auth/invite/complete) — uma VARIANTE do
 *      handler de confirmação de A3: mesma verificação de OTP e
 *      atualização de senha, mas ESTABELECE SESSÃO (auto-login) em vez de
 *      encerrar todas as sessões (SignOutGlobal), porque aqui é ativação
 *      inicial de conta, não redefinição de senha esquecida.
 *   3. Com sessão ativa, chama POST /invites/{code}/redeem (BEAC-1807,
 *      EXISTENTE E INALTERADO) para criar a membership Aluno e então segue
 *      para o dashboard — dali em diante o aluno só edita o próprio perfil
 *      (critério de permissão já garantido pelo motor de RBAC do Épico 3,
 *      DONE — nenhum código novo necessário aqui).
 *
 * ⚠️ POST /auth/invite/complete ainda não existe no rallye-api no momento
 * desta implementação — ver relatório de execução de BEAC-1860. Esta tela
 * foi construída e testada (mocks) contra o contrato travado; falta o
 * handler do lado do servidor (nenhum worktree de backend foi
 * disponibilizado para esta story).
 */
export function CompletarCadastro() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const email = searchParams.get('email') ?? ''
  const inviteCode = searchParams.get('invite') ?? ''

  const [phase, setPhase] = useState<Phase>(email && inviteCode ? 'sending_code' : 'missing_params')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [canResend, setCanResend] = useState(false)
  const [redeemFeedback, setRedeemFeedback] = useState<RedeemFeedback>(null)
  const sendAttempted = useRef(false)

  async function sendCode() {
    setPhase('sending_code')
    setServerError(null)
    try {
      await requestPasswordReset(email)
      setPhase('code_sent')
    } catch (err) {
      if (err instanceof PasswordResetApiError && err.code === 'rate_limited') {
        setServerError(err.message || 'Muitas tentativas. Aguarde 5 minutos e tente novamente.')
      } else {
        setServerError('Não foi possível enviar o código. Tente novamente.')
      }
      setPhase('send_failed')
    }
  }

  useEffect(() => {
    if (phase !== 'sending_code' || sendAttempted.current) return
    sendAttempted.current = true
    void sendCode()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  async function finishByRedeemingInvite() {
    setPhase('redeeming')
    setRedeemFeedback(null)
    try {
      await redeemInvite(inviteCode)
      setPhase('redeemed')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setPhase('code_sent')
      if (err instanceof RedeemInviteError) {
        if (err.code === 'invite_not_found') setRedeemFeedback('not_found')
        else if (err.code === 'invite_expired') setRedeemFeedback('expired')
        else if (err.code === 'already_member') {
          // Já é membro: não é um erro do ponto de vista do aluno, ele já
          // tem acesso — segue para o dashboard como se tivesse dado certo
          // (mesmo tom neutro de EnterArenaSheet, BEAC-1808).
          navigate('/dashboard', { replace: true })
          return
        } else setRedeemFeedback('internal_error')
      } else {
        setRedeemFeedback('internal_error')
      }
    }
  }

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

    setPhase('confirming')
    try {
      await completeInviteSignup(email, code, newPassword)
      await finishByRedeemingInvite()
    } catch (err) {
      setPhase('code_sent')
      if (err instanceof CompleteInviteError) {
        if (err.code === 'too_many_attempts') {
          setCanResend(true)
          setServerError('Muitas tentativas. Solicite um novo código.')
          return
        }
        if (err.code === 'code_expired') {
          setCanResend(true)
          setServerError('Código expirado. Solicite um novo.')
          return
        }
        if (err.code === 'invalid_code') {
          setServerError('Código inválido ou expirado.')
          return
        }
        setServerError(err.message)
        return
      }
      setServerError('Não foi possível concluir seu cadastro. Tente novamente.')
    }
  }

  if (phase === 'missing_params') {
    return (
      <section aria-labelledby="completar-cadastro-title">
        <AuthLayout
          cornerMark
          mark="none"
          title={<span id="completar-cadastro-title">Completar cadastro</span>}
        >
          <p role="alert" className="field-error">
            Link de convite inválido ou incompleto. Peça um novo link à sua arena.
          </p>
        </AuthLayout>
      </section>
    )
  }

  if (phase === 'sending_code') {
    return (
      <section aria-labelledby="completar-cadastro-title">
        <AuthLayout
          cornerMark
          mark="none"
          title={<span id="completar-cadastro-title">Completar cadastro</span>}
        >
          <p className="section-desc">Enviando código de confirmação...</p>
        </AuthLayout>
      </section>
    )
  }

  if (phase === 'send_failed') {
    return (
      <section aria-labelledby="completar-cadastro-title">
        <AuthLayout
          cornerMark
          mark="none"
          title={<span id="completar-cadastro-title">Completar cadastro</span>}
        >
          <p role="alert" className="field-error">
            {serverError}
          </p>
          <button
            type="button"
            className="btn btn-primary btn-md btn-full"
            onClick={() => void sendCode()}
          >
            Tentar novamente
          </button>
        </AuthLayout>
      </section>
    )
  }

  const submitting = phase === 'confirming' || phase === 'redeeming'

  return (
    <section aria-labelledby="completar-cadastro-title">
      <AuthLayout
        cornerMark
        mark="none"
        title={<span id="completar-cadastro-title">Completar cadastro</span>}
        subtitle="Enviamos um código de 6 dígitos para o seu e-mail — digite-o e escolha sua senha para ativar sua conta."
        hint="O link/código expira em 1 hora."
      >
        {redeemFeedback && (
          <p
            role={redeemFeedback === 'already_member' ? 'status' : 'alert'}
            className="field-error"
          >
            {REDEEM_MESSAGES[redeemFeedback]}
          </p>
        )}

        <p className="section-desc">Código enviado para: {email}</p>

        <form onSubmit={handleSubmit} noValidate className="stack">
          <div className="field">
            <label htmlFor="code">Código</label>
            <div className="control">
              <input
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                disabled={submitting}
                required
              />
            </div>
            {fieldErrors.code && (
              <p role="alert" className="error field-error">
                {fieldErrors.code}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="new-password">Senha</label>
            <div className="control">
              <input
                id="new-password"
                name="new-password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={submitting}
                required
              />
            </div>
            {fieldErrors.newPassword && (
              <p role="alert" className="error field-error">
                {fieldErrors.newPassword}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="confirm-password">Confirmar senha</label>
            <div className="control">
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={submitting}
                required
              />
            </div>
            {fieldErrors.confirmPassword && (
              <p role="alert" className="error field-error">
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>

          {serverError && (
            <p role="alert" className="error field-error">
              {serverError}
            </p>
          )}

          {canResend && (
            <button
              type="button"
              className="btn btn-secondary btn-md btn-full"
              onClick={() => {
                setCanResend(false)
                void sendCode()
              }}
            >
              Reenviar código
            </button>
          )}

          <button type="submit" className="btn btn-primary btn-md btn-full" disabled={submitting}>
            {phase === 'confirming' && 'Ativando conta...'}
            {phase === 'redeeming' && 'Entrando na arena...'}
            {phase !== 'confirming' && phase !== 'redeeming' && 'Ativar minha conta'}
          </button>
        </form>
      </AuthLayout>
    </section>
  )
}

export default CompletarCadastro
