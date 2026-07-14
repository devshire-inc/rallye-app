import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { OtpInput } from '../../components/OtpInput/OtpInput'
import {
  ResendVerificationError,
  VerifyEmailError,
  resendVerification,
  verifyEmail,
} from '../../lib/api'
import { getPendingVerification } from '../../lib/pendingVerification'
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
      setTimeout(() => navigate('/dashboard'), 1200)
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
    if (!userId || resendCooldown > 0) return
    setResendMessage(null)
    try {
      await resendVerification(userId)
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
      <section>
        <h1>Verificação de e-mail</h1>
        <p>Não foi possível identificar sua conta. Volte para o cadastro e tente novamente.</p>
      </section>
    )
  }

  if (deepLinkCode && (status === 'verifying' || status === 'success')) {
    return (
      <section>
        <h1>Verificação de e-mail</h1>
        <p>{status === 'verifying' ? 'Verificando seu e-mail...' : null}</p>
        {status === 'success' && <div role="status">Email verificado!</div>}
      </section>
    )
  }

  return (
    <section>
      <h1>Verificação de e-mail</h1>
      <p>
        Enviamos um código de 6 dígitos para <strong>{email ?? 'seu e-mail'}</strong>.
      </p>

      <OtpInput
        value={code}
        onChange={setCode}
        onComplete={(full) => void attemptVerify(full)}
        error={shake}
        disabled={status === 'verifying' || status === 'success'}
      />

      {status === 'invalid' && <p role="alert">Código incorreto</p>}
      {status === 'expired' && (
        <p role="alert">
          Código expirado. <button onClick={handleResend}>Reenviar?</button>
        </p>
      )}
      {status === 'locked' && (
        <p role="alert">Muitas tentativas. Tente novamente em alguns minutos.</p>
      )}
      {status === 'unrecoverable' && (
        <p role="alert">Não foi possível verificar agora. Tente novamente.</p>
      )}
      {status === 'success' && <div role="status">Email verificado!</div>}

      <div>
        {resendCooldown > 0 ? (
          <span>Reenviar código em {resendCooldown}s</span>
        ) : (
          <button onClick={handleResend}>Reenviar código</button>
        )}
        {resendMessage && <p role="alert">{resendMessage}</p>}
      </div>
    </section>
  )
}
