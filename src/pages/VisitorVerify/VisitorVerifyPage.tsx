import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { OtpInput } from '../../components/OtpInput/OtpInput'
import { VisitorVerifyError, verifyVisitorCode } from '../../lib/api'
import { getPendingVisitorRequest, clearPendingVisitorRequest } from '../../lib/pendingVisitorRequest'
import { setVisitorSession } from '../../lib/visitorSession'

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
        <h1>Código de acesso</h1>
        <p>Não foi possível identificar seu pedido de código. Volte e informe seu e-mail novamente.</p>
      </section>
    )
  }

  return (
    <section>
      <h1>Código de acesso</h1>
      <p>
        Enviamos um código de 6 dígitos para <strong>{email}</strong>.
      </p>

      <OtpInput
        value={code}
        onChange={setCode}
        onComplete={(full) => void attemptVerify(full)}
        error={shake}
        disabled={status === 'verifying' || status === 'success'}
      />

      {status === 'invalid' && <p role="alert">Código incorreto</p>}
      {status === 'unrecoverable' && (
        <p role="alert">Não foi possível verificar agora. Tente novamente.</p>
      )}
      {status === 'success' && <div role="status">Acesso liberado!</div>}
    </section>
  )
}
