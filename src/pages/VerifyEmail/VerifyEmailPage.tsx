import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AuthLayout } from '../../components/AuthLayout/AuthLayout'
import { OtpInput } from '../../components/OtpInput/OtpInput'
import { AlertCard } from '../../components/ui/AlertCard/AlertCard'
import { Pill } from '../../components/ui/Pill/Pill'
import {
  ResendVerificationError,
  VerifyEmailError,
  listMyMemberships,
  resendVerification,
  verifyEmail,
} from '../../lib/api'
import { getPendingVerification } from '../../lib/pendingVerification'
import { redirectPathForMemberships } from '../../lib/redirectTarget'
import './VerifyEmailPage.css'

const RESEND_COOLDOWN_SECONDS = 60

type Status = 'idle' | 'verifying' | 'invalid' | 'expired' | 'locked' | 'success' | 'unrecoverable'

/**
 * Tela A4 — verificação de e-mail (BEAC-1676). Só é alcançada logo após o
 * cadastro por senha (contas via social login pulam esta tela inteiramente —
 * decisão que vive no roteamento pós-cadastro, fora deste worktree).
 */
export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const pending = useMemo(() => getPendingVerification(), [])
  const userId = searchParams.get('user_id') ?? pending?.userId ?? null
  const email = searchParams.get('email') ?? pending?.email ?? null
  const deepLinkCode = searchParams.get('code')

  const [code, setCode] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [shake, setShake] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const deepLinkAttempted = useRef(false)

  async function attemptVerify(candidate: string) {
    if (!userId) return
    setStatus('verifying')
    try {
      await verifyEmail(userId, candidate)
      setStatus('success')
      // Busca as memberships em paralelo com o delay visual abaixo (BEAC-2079,
      // story BEAC-2057) — unifica o destino pós-verificação com o de login:
      // 1 membership vai direto pro dashboard daquela unit, 2+ ou 0 vão pro
      // S1 (0 memberships cai no empty-state que já existe lá). Falha aqui é
      // best-effort: melhor cair no destino de "sem memberships" (S1) do que
      // travar a navegação por causa de uma falha transitória no fetch.
      const membershipsPromise = listMyMemberships().catch(() => [])
      setTimeout(() => {
        void membershipsPromise.then((memberships) => {
          navigate(redirectPathForMemberships(memberships.map((m) => ({ unit_id: m.unitId }))))
        })
      }, 1200)
    } catch (err) {
      if (err instanceof VerifyEmailError) {
        if (err.code === 'invalid_code') {
          setStatus('invalid')
          setCode('')
          setShake(true)
          setTimeout(() => setShake(false), 400)
          return
        }
        if (err.code === 'code_expired' || err.code === 'code_not_found') {
          setStatus('expired')
          return
        }
        if (err.code === 'too_many_attempts' || err.code === 'locked') {
          setStatus('locked')
          return
        }
      }
      setStatus('unrecoverable')
    }
  }

  // Deep link: código chega na própria URL (link do e-mail) — verifica
  // automaticamente, sem exigir digitação.
  useEffect(() => {
    if (deepLinkCode && userId && !deepLinkAttempted.current) {
      deepLinkAttempted.current = true
      void attemptVerify(deepLinkCode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkCode, userId])

  // Contador de reenvio (60s), só relevante fora do fluxo de deep link.
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((s) => Math.max(0, s - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  async function handleResend() {
    if (!userId || !email || resendCooldown > 0) return
    setResendMessage(null)
    try {
      await resendVerification(userId, email)
      setCode('')
      setStatus('idle')
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      if (err instanceof ResendVerificationError && err.code === 'too_many_resends') {
        setResendMessage('Muitos reenvios. Tente novamente mais tarde.')
      } else {
        setResendMessage('Não foi possível reenviar o código. Tente novamente.')
      }
    }
  }

  if (!userId) {
    return (
      <section aria-labelledby="verify-email-title">
        <AuthLayout
          onBack={() => navigate(-1)}
          heroTitle="Quase lá!"
          heroSubtitle="Confirme seu e-mail pra continuar."
          title={<span id="verify-email-title">Verificação de e-mail</span>}
        >
          <p className="section-desc">
            Não foi possível identificar sua conta. Volte para o cadastro e tente novamente.
          </p>
        </AuthLayout>
      </section>
    )
  }

  if (deepLinkCode && (status === 'verifying' || status === 'success')) {
    return (
      <section aria-labelledby="verify-email-title">
        <AuthLayout
          onBack={() => navigate(-1)}
          heroTitle="Quase lá!"
          heroSubtitle="Confirme seu e-mail pra continuar."
          title={<span id="verify-email-title">Verificação de e-mail</span>}
        >
          {status === 'verifying' && <p className="section-desc">Verificando seu e-mail...</p>}
          {status === 'success' && (
            <AlertCard tone="success">
              <p role="status">Email verificado!</p>
            </AlertCard>
          )}
        </AuthLayout>
      </section>
    )
  }

  return (
    <section aria-labelledby="verify-email-title">
      <AuthLayout
        onBack={() => navigate(-1)}
        heroTitle="Quase lá!"
        heroSubtitle="Confirme seu e-mail pra continuar."
        title={<span id="verify-email-title">Confira seu e-mail</span>}
        subtitle={
          <>
            Enviamos um código de 6 dígitos para <b>{email ?? 'seu e-mail'}</b>
          </>
        }
        hint={
          <Pill>
            <b>DEMO</b> 123456
          </Pill>
        }
      >
        <div className="stack">
          <div className="stack" style={{ gap: 8 }}>
            <span className="otp-label">Código</span>
            <OtpInput
              value={code}
              onChange={setCode}
              onComplete={(full) => void attemptVerify(full)}
              error={shake}
              disabled={status === 'verifying' || status === 'success'}
            />
          </div>

          {status === 'invalid' && (
            <AlertCard tone="danger">
              <p role="alert">Código incorreto</p>
            </AlertCard>
          )}
          {status === 'expired' && (
            <AlertCard tone="danger">
              <p role="alert">
                Código expirado.{' '}
                <button className="inline-action-button" onClick={handleResend}>
                  Reenviar?
                </button>
              </p>
            </AlertCard>
          )}
          {status === 'locked' && (
            <AlertCard tone="danger">
              <p role="alert">Muitas tentativas. Tente novamente em alguns minutos.</p>
            </AlertCard>
          )}
          {status === 'unrecoverable' && (
            <AlertCard tone="danger">
              <p role="alert">Não foi possível verificar agora. Tente novamente.</p>
            </AlertCard>
          )}
          {status === 'success' && (
            <AlertCard tone="success">
              <p role="status">Email verificado!</p>
            </AlertCard>
          )}

          <div className="footer-link">
            {resendCooldown > 0 ? (
              <span>Reenviar código em {resendCooldown}s</span>
            ) : (
              <button className="inline-action-button inline-action-button--footer" onClick={handleResend}>
                Reenviar código
              </button>
            )}
            {resendMessage && (
              <p role="alert" className="field-error">
                {resendMessage}
              </p>
            )}
          </div>
        </div>
      </AuthLayout>
    </section>
  )
}
