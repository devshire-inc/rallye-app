import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AuthLayout } from '../../components/AuthLayout/AuthLayout'
import { VisitorRequestError, requestVisitorCode } from '../../lib/api'
import { setPendingVisitorRequest } from '../../lib/pendingVisitorRequest'

type Status = 'idle' | 'sending' | 'account_exists' | 'error'

/**
 * Tela A5 etapa 1 (BEAC-1821) — visitante informa o e-mail para receber o
 * código de acesso temporário a um torneio específico.
 */
export function VisitorRequestPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!tournamentId || !email) return
    setStatus('sending')
    setErrorMessage(null)
    try {
      const result = await requestVisitorCode(email, tournamentId)
      if (result.accountExists) {
        setStatus('account_exists')
        return
      }
      setPendingVisitorRequest({ email, tournamentId })
      navigate(`/tournaments/${tournamentId}/visitor/verify`)
    } catch (err) {
      if (err instanceof VisitorRequestError && err.code === 'too_many_resends') {
        setErrorMessage('Muitos pedidos de código. Tente novamente mais tarde.')
      } else {
        setErrorMessage('Não foi possível enviar o código agora. Tente novamente.')
      }
      setStatus('error')
    }
  }

  function handleViewOnly() {
    if (!tournamentId) return
    navigate(`/tournaments/${tournamentId}`)
  }

  function handleGoToLogin() {
    navigate(`/login?email=${encodeURIComponent(email)}`)
  }

  return (
    <section>
      <AuthLayout
        cornerMark
        mark="sm"
        wide
        title="Acompanhar torneio"
        subtitle="Informe seu e-mail para receber um código de acesso temporário a este torneio."
        hint="Sessão de visitante dura 72h ou até o fim do torneio + 24h."
      >
        <form onSubmit={handleSubmit} className="stack">
          <div className="field">
            <label htmlFor="visitor-email">E-mail</label>
            <div className="control">
              <input
                id="visitor-email"
                type="email"
                placeholder="voce@email.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === 'sending'}
              />
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-md btn-full"
            disabled={status === 'sending' || !email}
          >
            Enviar código
          </button>
        </form>

        {status === 'account_exists' && (
          <p role="alert" className="field-error">
            Você já tem conta! <button onClick={handleGoToLogin}>Fazer login?</button>
          </p>
        )}
        {status === 'error' && errorMessage && (
          <p role="alert" className="field-error">
            {errorMessage}
          </p>
        )}

        <button type="button" className="btn btn-ghost btn-md btn-full" onClick={handleViewOnly}>
          Apenas visualizar
        </button>
      </AuthLayout>
    </section>
  )
}
