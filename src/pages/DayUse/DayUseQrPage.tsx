import QRCode from 'qrcode'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { getDayUseQr, type DayUseQr } from '../../lib/api/dayUseFlow'
import { calendarLink, directionsLink } from '../../lib/dayUseCalendar'
import { formatBRL } from '../../lib/money'
import { formatDateBR } from '../../lib/subscriptionPeriod'
import { sportLabel } from '../../lib/sports'
import '../../components/AuthLayout/AuthLayout.css'
import './DayUseQrPage.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'not-found' }
  | { status: 'ready'; qr: DayUseQr }

/**
 * DU4 — QR Code de Acesso (BEAC-1963, story BEAC-1928). Markup/copy lidos
 * diretamente da doc real (Allye, UX e Telas > Financeiro > DU4): "Reserva
 * Confirmada!" + QR grande + "Apresente na recepção" + detalhes (arena,
 * data, horário, esporte, valor pago) + botões "COMO CHEGAR"/"ADICIONAR AO
 * CALENDÁRIO".
 *
 * Rota `/day-use-bookings/:bookingId` — mesmo formato de recurso do backend
 * (GET /day-use-bookings/{id}/qr, BEAC-1959), registrada em App.tsx nesta
 * dispatch. Unit-agnostica de propósito: o backend resolve a unit certa a
 * partir só do booking id (ver comentário de pacote em
 * rallye-api/api/internal/dayuse/checkin.go).
 *
 * ## Um esporte, não "esportes" (divergência deliberada da doc)
 *
 * A doc de DU4 (herdando o texto de DU2/DU3, onde o card de Day Use é
 * agregado no nível da ARENA) fala em "esportes" no plural. Esta tela é o
 * RECIBO de uma reserva específica — BookHandler (BEAC-1958) aloca a
 * reserva numa ÚNICA quadra/esporte (ver comentário de pacote em book.go), e
 * é exatamente esse esporte que o backend devolve aqui. Mostrar o esporte
 * singular é o dado real da reserva, não uma omissão.
 *
 * ## QR renderizado com a lib `qrcode` (dependência nova desta task)
 *
 * Não existia nenhuma lib de geração de QR neste projeto. `qrcode` (mesma
 * biblioteca amplamente usada, sem dependências nativas) gera um data URL
 * PNG a partir do token assinado devolvido por GET .../qr — decisão tomada
 * nesta task (não uma pergunta em aberto: o AC pede um QR code "grande" de
 * verdade, um placeholder inerte contrariaria o propósito central desta
 * tela).
 */
export default function DayUseQrPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { bookingId } = useParams<{ bookingId: string }>()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  const load = useCallback(
    (onCancelled: () => boolean) => {
      if (!bookingId) return
      getDayUseQr(bookingId)
        .then((result) => {
          if (onCancelled()) return
          if (!result.ok) {
            setState(result.status === 404 ? { status: 'not-found' } : { status: 'error' })
            return
          }
          setState({ status: 'ready', qr: result.qr })
        })
        .catch(() => {
          if (onCancelled()) return
          setState({ status: 'error' })
        })
    },
    [bookingId],
  )

  useEffect(() => {
    let cancelled = false
    load(() => cancelled)
    return () => {
      cancelled = true
    }
  }, [load])

  useEffect(() => {
    if (state.status !== 'ready') {
      return
    }
    let cancelled = false
    QRCode.toDataURL(state.qr.token, { width: 240, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [state])

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="pg-head">
        <span className="back" style={{ opacity: 0.55 }}>
          ‹ Day Use
        </span>
      </div>

      <div className="dash-body du4-body">
        {state.status === 'loading' ? <p role="status">Carregando reserva…</p> : null}
        {state.status === 'error' ? (
          <p role="alert">Não foi possível carregar esta reserva.</p>
        ) : null}
        {state.status === 'not-found' ? <p role="alert">Reserva não encontrada.</p> : null}

        {state.status === 'ready' ? <QrDetail qr={state.qr} qrDataUrl={qrDataUrl} /> : null}
      </div>
    </AppShell>
  )
}

function QrDetail({ qr, qrDataUrl }: { qr: DayUseQr; qrDataUrl: string | null }) {
  return (
    <>
      <h1 className="du4-title">{qr.expired ? 'Day Use expirado' : 'Reserva Confirmada!'}</h1>

      <div className={`du4-qr-frame${qr.expired ? ' du4-qr-expired' : ''}`}>
        {qrDataUrl ? (
          <img src={qrDataUrl} alt={`QR code de acesso da reserva ${qr.bookingId}`} />
        ) : (
          <p role="status">Gerando QR…</p>
        )}
      </div>

      <p className="hint du4-hint">
        {qr.expired ? 'Este Day Use já venceu.' : 'Apresente na recepção'}
      </p>

      <div className="card du4-details">
        <div className="du4-row">
          <span className="hint">Arena</span>
          <span>{qr.unitName}</span>
        </div>
        <div className="du4-row">
          <span className="hint">Data</span>
          <span>{formatDateBR(qr.date)}</span>
        </div>
        <div className="du4-row">
          <span className="hint">Horário</span>
          <span>
            {qr.startTime} - {qr.endTime}
          </span>
        </div>
        <div className="du4-row">
          <span className="hint">Esporte</span>
          <span>{sportLabel(qr.sport)}</span>
        </div>
        <div className="du4-row">
          <span className="hint">Valor pago</span>
          <span>{formatBRL(qr.amountPaid)}</span>
        </div>
      </div>

      <div className="du4-actions">
        <a className="btn btn-ghost" href={directionsLink(qr)} target="_blank" rel="noreferrer">
          COMO CHEGAR
        </a>
        <a className="btn btn-ghost" href={calendarLink(qr)} target="_blank" rel="noreferrer">
          ADICIONAR AO CALENDÁRIO
        </a>
      </div>
    </>
  )
}
