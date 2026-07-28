import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { Button } from '../../components/ui/Button/Button'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import {
  bookDayUse,
  getDayUseDetail,
  todayIsoDate,
  type DayUseDetail,
} from '../../lib/api/dayUseFlow'
import { formatDateBR } from '../../lib/subscriptionPeriod'
import { formatBRL } from '../../lib/money'
import { sportLabel } from '../../lib/sports'
import '../../components/AuthLayout/AuthLayout.css'
import './DayUseDetailPage.css'
import './DayUseConfirmPage.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'not-found' }
  | { status: 'unavailable'; detail: DayUseDetail }
  | { status: 'ready'; detail: DayUseDetail }

type BookState =
  { status: 'idle' } | { status: 'booking' } | { status: 'slot-taken' } | { status: 'error' }

/** DU3 — Confirmar e Pagar Day Use (BEAC-1962, story BEAC-1928). Markup/copy
 * lidos diretamente da doc real (Allye, UX e Telas > Financeiro > DU3):
 * resumo da arena, dados da reserva (data/horário/esportes inclusos),
 * resumo de pagamento, CTA "CONFIRMAR E PAGAR — R$ X".
 *
 * Rota `/day-use/:unitId/confirm` — já referenciada (mas não registrada) por
 * DayUseDiscoveryPage.tsx/DayUseDetailPage.tsx (BEAC-1960/1961), registrada
 * em App.tsx nesta mesma dispatch.
 *
 * ## Data da reserva: router state ou "hoje" (mesmo default de DU1)
 *
 * DayUseDiscoveryPage repassa a data selecionada via
 * `navigate(du3Path, { state: { date } })`. DayUseDetailPage (DU2) NÃO
 * repassa nada (gap pré-existente daquela dispatch, documentado no
 * comentário de arquivo de DayUseDetailPage.tsx — DU2 sempre mostra "hoje",
 * sem seletor de data) — chegar aqui a partir de DU2 cai no MESMO default
 * "hoje" que DU1 já usa (todayIsoDate, agora compartilhado via
 * lib/api/dayUseFlow.ts).
 *
 * ## Sem hold/timer — divergência DELIBERADA da doc (AC explícito desta task)
 *
 * A doc de DU3 mostra um cronômetro "vaga garantida por 5 min" que
 * pressupõe um redirect de pagamento real (Abacate Pay, pós-MVP,
 * inexistente nesta base). O AC desta task já resolve isso: sem hold/
 * pending (public.bookings.status só aceita confirmed/cancelled, Épico 6,
 * travado) — "Confirmar e pagar" é uma AÇÃO ÚNICA e definitiva, chama
 * POST /units/{id}/day-use-bookings diretamente. Nenhum cronômetro é
 * renderizado.
 *
 * ## "Ops! Última vaga foi preenchida" — corrida real, não hipotética
 *
 * O backend (BookHandler, BEAC-1958) faz a checagem definitiva de vaga
 * dentro de uma transação com lock — 409 é a resposta de fato quando a vaga
 * já foi ocupada entre o carregamento desta tela e o clique no CTA (mesma
 * corrida documentada no comentário de arquivo de DayUseDetailPage.tsx).
 */
export default function DayUseConfirmPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId } = useParams<{ unitId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [bookState, setBookState] = useState<BookState>({ status: 'idle' })

  const date = (location.state as { date?: string } | null)?.date ?? todayIsoDate()

  const load = useCallback(
    (onCancelled: () => boolean) => {
      if (!unitId) return
      getDayUseDetail(unitId, date)
        .then((result) => {
          if (onCancelled()) return
          if (!result.ok) {
            setState(result.status === 404 ? { status: 'not-found' } : { status: 'error' })
            return
          }
          setState(
            result.detail.dayUse
              ? { status: 'ready', detail: result.detail }
              : { status: 'unavailable', detail: result.detail },
          )
        })
        .catch(() => {
          if (onCancelled()) return
          setState({ status: 'error' })
        })
    },
    [unitId, date],
  )

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  const handleConfirm = useCallback(() => {
    if (!unitId) return
    setBookState({ status: 'booking' })
    bookDayUse(unitId, date)
      .then((result) => {
        if (!result.ok) {
          if ('slotTaken' in result && result.slotTaken) {
            setBookState({ status: 'slot-taken' })
            return
          }
          setBookState({ status: 'error' })
          return
        }
        navigate(`/day-use-bookings/${result.booking.id}`, { replace: true })
      })
      .catch(() => {
        setBookState({ status: 'error' })
      })
  }, [unitId, date, navigate])

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head">
        <span className="back" style={{ opacity: 0.55 }}>
          ‹{' '}
          {state.status === 'ready' || state.status === 'unavailable'
            ? state.detail.name
            : 'Confirmar'}
        </span>
      </div>

      <div className="dash-body">
        {state.status === 'loading' ? <p role="status">Carregando resumo…</p> : null}
        {state.status === 'error' ? (
          <p role="alert">Não foi possível carregar o resumo desta reserva.</p>
        ) : null}
        {state.status === 'not-found' ? <p role="alert">Arena não encontrada.</p> : null}
        {state.status === 'unavailable' ? (
          <p className="hint">Day Use não está mais disponível para esta data.</p>
        ) : null}

        {state.status === 'ready' && bookState.status === 'slot-taken' ? (
          <SlotTakenPanel onBack={() => navigate(-1)} />
        ) : null}

        {state.status === 'ready' && bookState.status !== 'slot-taken' ? (
          <ConfirmSummary
            detail={state.detail}
            date={date}
            confirming={bookState.status === 'booking'}
            showError={bookState.status === 'error'}
            onConfirm={handleConfirm}
          />
        ) : null}
      </div>
    </AppShell>
  )
}

function ConfirmSummary({
  detail,
  date,
  confirming,
  showError,
  onConfirm,
}: {
  detail: DayUseDetail
  date: string
  confirming: boolean
  showError: boolean
  onConfirm: () => void
}) {
  const dayUse = detail.dayUse
  if (!dayUse) return null

  return (
    <>
      <div className="card du3-arena-summary">
        <b>{detail.name}</b>
        <div className="hint">📍 {detail.address}</div>
      </div>

      <div className="card du3-reservation-summary">
        <div className="du3-row">
          <span className="hint">Data</span>
          <span>{formatDateBR(date)}</span>
        </div>
        <div className="du3-row">
          <span className="hint">Horário</span>
          <span>
            {dayUse.startTime} - {dayUse.endTime}
          </span>
        </div>
        <div className="du3-row">
          <span className="hint">Esportes inclusos</span>
          <span>{dayUse.sports.map((s) => sportLabel(s)).join(', ')}</span>
        </div>
      </div>

      <div className="card du3-payment-summary">
        <div className="du3-row">
          <span className="hint">Day Use</span>
          <span>{formatBRL(dayUse.price)}</span>
        </div>
        <div className="du3-row du3-total">
          <span>Total</span>
          <span>{formatBRL(dayUse.price)}</span>
        </div>
      </div>

      {showError ? (
        <p role="alert">Não foi possível confirmar a reserva. Tente novamente.</p>
      ) : null}

      <Button variant="primary" size="lg" fullWidth disabled={confirming} onClick={onConfirm}>
        {confirming ? 'CONFIRMANDO…' : `CONFIRMAR E PAGAR — ${formatBRL(dayUse.price)}`}
      </Button>
    </>
  )
}

function SlotTakenPanel({ onBack }: { onBack: () => void }) {
  return (
    <div className="card du3-slot-taken">
      <p role="alert">Ops! Última vaga foi preenchida.</p>
      <Button variant="ghost" onClick={onBack}>
        ‹ Voltar
      </Button>
    </div>
  )
}
