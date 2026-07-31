import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AuthLayout } from '../../components/AuthLayout/AuthLayout'
import { OtpInput } from '../../components/OtpInput/OtpInput'
import { AlertCard } from '../../components/ui/AlertCard/AlertCard'
import { Pill } from '../../components/ui/Pill/Pill'
import { VisitorVerifyError, verifyVisitorCode } from '../../lib/api'
import {
  getPendingVisitorRequest,
  clearPendingVisitorRequest,
} from '../../lib/pendingVisitorRequest'
import { setVisitorSession } from '../../lib/visitorSession'
import './VisitorVerifyPage.css'

type Status = 'idle' | 'verifying' | 'invalid' | 'success' | 'unrecoverable'

/**
 * Tela A5 etapa 2 (BEAC-1822) — visitante digita o código de 6 dígitos
 * recebido por e-mail (etapa 1, BEAC-1821). Ao validar, ativa a sessão
 * temporária (BEAC-1820) e navega para a visão do torneio com notificações
 * habilitadas. Reusa o OtpInput já existente de BEAC-1676 — não recriado
 * aqui.
 */
export function VisitorVerifyPage() {
  const { tournamentId: tournamentIdParam } = useParams<{ tournamentId: string }>()
  const navigate = useNavigate()

  const pending = useMemo(() => getPendingVisitorRequest(), [])
  const email = pending?.email ?? null
  const tournamentId = tournamentIdParam ?? pending?.tournamentId ?? null

  const [code, setCode] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [shake, setShake] = useState(false)

  async function attemptVerify(candidate: string) {
    if (!email || !tournamentId) return
    setStatus('verifying')
    try {
      const result = await verifyVisitorCode(email, tournamentId, candidate)
      setVisitorSession({ email, tournamentId, scope: result.scope, expiresAt: result.expiresAt })
      clearPendingVisitorRequest()
      setStatus('success')
      navigate(`/tournaments/${tournamentId}?notifications=1`)
    } catch (err) {
      if (err instanceof VisitorVerifyError && err.code === 'invalid_code') {
        setStatus('invalid')
        setCode('')
        setShake(true)
        setTimeout(() => setShake(false), 400)
        return
      }
      setStatus('unrecoverable')
    }
  }

  if (!email || !tournamentId) {
    return (
      <section>
        <AuthLayout
          onBack={() => navigate(-1)}
          heroTitle="Bora pra quadra!"
          heroSubtitle="Confirme o código pra liberar seu acesso."
          title="Código de acesso"
        >
          <p className="section-desc">
            Não foi possível identificar seu pedido de código. Volte e informe seu e-mail novamente.
          </p>
        </AuthLayout>
      </section>
    )
  }

  return (
    <section>
      <AuthLayout
        onBack={() => navigate(-1)}
        heroTitle="Bora pra quadra!"
        heroSubtitle="Confirme o código pra liberar seu acesso."
        title="Digite o código"
        subtitle={
          <>
            Enviamos um código de 6 dígitos para <b>{email}</b>
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
          {status === 'unrecoverable' && (
            <AlertCard tone="danger">
              <p role="alert">Não foi possível verificar agora. Tente novamente.</p>
            </AlertCard>
          )}
          {status === 'success' && (
            <AlertCard tone="success">
              <p role="status">Acesso liberado!</p>
            </AlertCard>
          )}
        </div>
      </AuthLayout>
    </section>
  )
}
