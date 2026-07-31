import { useEffect, useState } from 'react'
import { Button } from '../Button/Button'
import './WaitlistCard.css'

export type WaitlistCardState = 'aguardando' | 'vaga-disponivel' | 'expirado'

export interface WaitlistCardProps {
  /** Posição do aluno na fila — exibida no círculo quando `state` é `aguardando`. */
  position?: number
  state: WaitlistCardState
  /** Nome da aula/quadra pela qual o aluno está na fila. */
  title: string
  /** Instante em que a vaga liberada expira. Só relevante em `vaga-disponivel`;
   * o countdown ("restam N minutos") é calculado e atualizado internamente. */
  expiresAt?: string | Date
  onReserve?: () => void
}

const ONE_MINUTE_MS = 60_000

/** Minutos inteiros restantes até `expiresAt`, nunca negativo — arredonda pra
 * cima pra não anunciar "0 minutos" enquanto ainda resta tempo real. */
function minutesRemaining(expiresAt: string | Date, now: number): number {
  const target = new Date(expiresAt).getTime()
  return Math.max(0, Math.ceil((target - now) / ONE_MINUTE_MS))
}

function useMinutesRemaining(expiresAt: string | Date | undefined): number | null {
  const [minutes, setMinutes] = useState<number | null>(
    expiresAt ? minutesRemaining(expiresAt, Date.now()) : null,
  )

  useEffect(() => {
    if (!expiresAt) {
      setMinutes(null)
      return
    }

    setMinutes(minutesRemaining(expiresAt, Date.now()))
    const id = setInterval(() => {
      setMinutes(minutesRemaining(expiresAt, Date.now()))
    }, ONE_MINUTE_MS)

    return () => clearInterval(id)
  }, [expiresAt])

  return minutes
}

export function WaitlistCard({ position, state, title, expiresAt, onReserve }: WaitlistCardProps) {
  const minutes = useMinutesRemaining(state === 'vaga-disponivel' ? expiresAt : undefined)

  const isExpirado = state === 'expirado'
  const isVagaDisponivel = state === 'vaga-disponivel'

  const subtitle = isExpirado
    ? 'Você perdeu a vez nesta rodada.'
    : isVagaDisponivel
      ? minutes !== null
        ? `Restam ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`
        : ''
      : 'Avisaremos quando abrir uma vaga'

  return (
    <div className="waitlist-card">
      <span className="waitlist-card__position">{isExpirado ? '—' : position}</span>
      <div className="waitlist-card__text-col">
        <span className="waitlist-card__title">{title}</span>
        <span
          className={`waitlist-card__subtitle waitlist-card__subtitle--${state}`}
          aria-live={isVagaDisponivel ? 'polite' : undefined}
        >
          {subtitle}
        </span>
      </div>
      {isVagaDisponivel ? (
        <Button variant="primary" size="sm" onClick={onReserve}>
          Reservar
        </Button>
      ) : null}
    </div>
  )
}
