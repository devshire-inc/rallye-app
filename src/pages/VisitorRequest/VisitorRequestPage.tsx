import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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
      <h1>Acompanhar torneio</h1>
      <p>Informe seu e-mail para receber um código de acesso temporário a este torneio.</p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="visitor-email">E-mail</label>
        <input
          id="visitor-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === 'sending'}
        />
        <button type="submit" disabled={status === 'sending' || !email}>
          Enviar código
        </button>
      </form>

      {status === 'account_exists' && (
        <p role="alert">
          Você já tem conta! <button onClick={handleGoToLogin}>Fazer login?</button>
        </p>
      )}
      {status === 'error' && errorMessage && <p role="alert">{errorMessage}</p>}

      <button type="button" onClick={handleViewOnly}>
        Apenas visualizar
      </button>
    </section>
  )
}
