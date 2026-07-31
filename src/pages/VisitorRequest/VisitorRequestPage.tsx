import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AuthLayout } from '../../components/AuthLayout/AuthLayout'
import { AlertCard } from '../../components/ui/AlertCard/AlertCard'
import { Button } from '../../components/ui/Button/Button'
import { Input } from '../../components/ui/Input/Input'
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
        onBack={() => navigate(-1)}
        heroTitle="Bora pra quadra!"
        heroSubtitle="Acompanhe o torneio sem precisar de conta."
        wide
        title="Acompanhar torneio"
        subtitle="Informe seu e-mail pra receber um código de acesso temporário. Sessão de visitante dura 72h."
      >
        <form onSubmit={handleSubmit} className="stack">
          <Input
            id="visitor-email"
            type="email"
            label="E-mail"
            placeholder="voce@email.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === 'sending'}
          />

          {status === 'account_exists' && (
            <AlertCard tone="info">
              <p role="alert">
                Você já tem conta!{' '}
                <button type="button" className="inline-action-button" onClick={handleGoToLogin}>
                  Fazer login?
                </button>
              </p>
            </AlertCard>
          )}
          {status === 'error' && errorMessage && (
            <AlertCard tone="danger">
              <p role="alert">{errorMessage}</p>
            </AlertCard>
          )}

          <Button type="submit" fullWidth disabled={status === 'sending' || !email}>
            Enviar código
          </Button>
        </form>

        <Button type="button" variant="ghost" fullWidth onClick={handleViewOnly}>
          Apenas visualizar
        </Button>
      </AuthLayout>
    </section>
  )
}
