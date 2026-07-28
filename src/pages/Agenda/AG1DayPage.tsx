import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { IconButton } from '../../components/ui/IconButton/IconButton'
import { Input } from '../../components/ui/Input/Input'
import { Segmented } from '../../components/ui/Segmented/Segmented'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { getBookingsGrid, type Booking } from '../../lib/api/bookings'
import { listCourts, type Court } from '../../lib/api/courts'
import {
  bookingColorClass,
  bookingTitle,
  bookingTypeLabel,
  courtSportCssVar,
  dayWindow,
  formatHour,
  gridRowForInstant,
  GRID_END_HOUR,
  GRID_START_HOUR,
  HOURS,
  LEGEND_ITEMS,
  matchesSearch,
  formatWeekdayDate,
  isSameDay,
  ROW_HEADER_PX,
  ROW_HOUR_PX,
} from './agendaShared'
import { NovaReservaSheet, type NovaReservaPrefill } from './NovaReservaSheet'
import '../../components/AuthLayout/AuthLayout.css'
import './Agenda.css'

/**
 * AG1 — Calendário Dia (BEAC-1903, story BEAC-1704). Markup/classes
 * (`.cal-grid`, `.booking`, `.now-line`, `.col-blocked`, `.legend`) copiados
 * do protótipo real (scr-ag1, artifact "Rallye — Agenda", tool-results/
 * artifact-*.html linhas 537-611 lidas integralmente antes de implementar) —
 * NÃO é uma variação de props de AG2Week Page (decisão travada do dispatch:
 * "AG1 e AG2 são estruturalmente diferentes... dois componentes separados").
 *
 * Quadras como colunas (uma por quadra da unit, incluindo as em manutenção —
 * ver comentário de ../../lib/api/courts.ts sobre por que o overlay
 * `.col-blocked` precisa da quadra aparecer mesmo sem nenhuma reserva),
 * horários como linhas (06h-22h, ver agendaShared.HOURS).
 */
export default function AG1DayPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const initialDate = searchParams.get('date') ? new Date(searchParams.get('date')!) : new Date()
  const [date, setDate] = useState(initialDate)
  const [courts, setCourts] = useState<Court[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [viewOnly, setViewOnly] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [now, setNow] = useState(new Date())
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetPrefill, setSheetPrefill] = useState<NovaReservaPrefill | undefined>(undefined)
  // Incrementado a cada abertura para forçar remount de NovaReservaSheet
  // (ver comentário de NovaReservaSheet.tsx — o reset de formulário depende
  // de um `key` novo, não de um efeito que chama setState no corpo).
  const [sheetKey, setSheetKey] = useState(0)

  useEffect(() => {
    if (!unitId) return
    let cancelled = false
    listCourts(unitId).then((result) => {
      if (!cancelled && result.ok) setCourts(result.courts)
    })
    return () => {
      cancelled = true
    }
  }, [unitId])

  // Guarda contra setState depois de desmontar (ex.: troca rápida de dia
  // durante um fetch em voo, ou desmonte de teste) — evita tanto o warning
  // do React quanto uma promise não tratada tentando reaplicar um mock já
  // restaurado em teste.
  const mountedRef = useRef(true)
  useEffect(
    () => () => {
      mountedRef.current = false
    },
    [],
  )

  const reloadBookings = useCallback(() => {
    if (!unitId) return
    const { from, to } = dayWindow(date)
    getBookingsGrid(unitId, from, to)
      .then((result) => {
        if (!mountedRef.current) return
        if (!result.ok) {
          setLoadError(`Não foi possível carregar a agenda (${result.error}).`)
          return
        }
        setLoadError(null)
        setBookings(result.bookings)
        setViewOnly(result.viewOnly)
      })
      .catch(() => {
        // getBookingsGrid não deveria rejeitar (erros de API já viram
        // {ok: false} tratado acima) — mas uma falha de rede real (fetch
        // lançando) não pode virar unhandled rejection no app rodando.
        if (!mountedRef.current) return
        setLoadError('Não foi possível carregar a agenda (falha de rede).')
      })
  }, [unitId, date])

  useEffect(() => {
    reloadBookings()
  }, [reloadBookings])

  // Linha "agora" — atualizada ao vivo (AC: "indicando o horário atual,
  // atualizada ao vivo"). 60s é granularidade suficiente para uma grade de
  // slots de 1h.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const visibleBookings = useMemo(
    () => bookings.filter((b) => matchesSearch(b, search)),
    [bookings, search],
  )

  function bookingsForCourt(courtId: string): Booking[] {
    return visibleBookings.filter((b) => b.courtId === courtId)
  }

  function goWeek() {
    navigate(`/units/${unitId}/agenda/semana?date=${date.toISOString().slice(0, 10)}`)
  }

  function changeDay(delta: number) {
    const next = new Date(date)
    next.setDate(next.getDate() + delta)
    setDate(next)
  }

  function openSheetForSlot(courtId: string, hour: number) {
    if (viewOnly) return
    setSheetPrefill({ courtId, date, startHour: hour })
    setSheetKey((k) => k + 1)
    setSheetOpen(true)
  }

  function openSheetForFab() {
    setSheetPrefill({ date })
    setSheetKey((k) => k + 1)
    setSheetOpen(true)
  }

  const today = isSameDay(date, new Date())
  const dateLabel = `${today ? 'Hoje · ' : ''}${formatWeekdayDate(date)}`

  // Posição da linha "agora" em px — mesma ideia do protótipo real (calcula
  // um `top` em px via JS), usando as mesmas constantes de altura de linha do
  // CSS (ROW_HEADER_PX/ROW_HOUR_PX, ver Agenda.css `.cal-grid`) para as duas
  // nunca divergirem. Só aparece quando o dia mostrado é hoje e o horário
  // está dentro da janela 06h-22h.
  const nowTopPx =
    today && now.getHours() >= GRID_START_HOUR && now.getHours() < GRID_END_HOUR
      ? ROW_HEADER_PX + ((now.getHours() - GRID_START_HOUR) * 60 + now.getMinutes()) * (ROW_HOUR_PX / 60)
      : null

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="ag-head">
        <h1>Agenda</h1>
        <div className="spacer" />
        <div className="date-nav">
          <IconButton variant="secondary" size="sm" label="Dia anterior" onClick={() => changeDay(-1)}>
            ‹
          </IconButton>
          <span className="dlabel">{dateLabel}</span>
          <IconButton variant="secondary" size="sm" label="Próximo dia" onClick={() => changeDay(1)}>
            ›
          </IconButton>
        </div>
        <Segmented
          ariaLabel="Alternar entre visão Dia e Semana"
          options={['Dia', 'Semana']}
          value="Dia"
          onChange={(option) => {
            if (option === 'Semana') goWeek()
          }}
        />
        <Input
          type="search"
          ariaLabel="Buscar por aluno, professor ou quadra"
          placeholder="🔍 Buscar"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loadError ? <p role="alert">{loadError}</p> : null}

      <div className="legend">
        {LEGEND_ITEMS.map((item) => (
          <span key={item.label}>
            <span className={`sq ${item.colorClass}`} />
            {item.label}
          </span>
        ))}
        <span>
          <span className="sq sq-free" />
          Livre — toque para reservar
        </span>
      </div>

      <div className="cal-wrap">
        <div
          className="cal-grid"
          style={{ gridTemplateColumns: `64px repeat(${courts.length}, 1fr)` }}
        >
          <div className="head" />
          {courts.map((court) => (
            <div className="head" key={court.id}>
              <span className="cq">
                <span className="dot" style={{ background: `var(${courtSportCssVar(court)})` }} />
                {court.name}
              </span>
              <small>{court.status === 'maintenance' ? 'Manutenção' : court.sport}</small>
            </div>
          ))}

          {HOURS.map((hour) => (
            <div className="hr" key={hour}>
              {formatHour(hour)}
            </div>
          ))}

          {courts.map((court) =>
            court.status === 'maintenance' ? (
              <div className="col-blocked" key={`blocked-${court.id}`}>
                <span>Manutenção até sexta</span>
              </div>
            ) : (
              HOURS.map((hour) =>
                bookingsForCourt(court.id).some((b) => new Date(b.startAt).getHours() <= hour && new Date(b.endAt).getHours() > hour) ? null : (
                  <div
                    key={`${court.id}-${hour}`}
                    className="cal-cell"
                    data-newslot
                    role="button"
                    tabIndex={viewOnly ? -1 : 0}
                    aria-label={`Horário livre ${court.name} ${formatHour(hour)}`}
                    aria-disabled={viewOnly}
                    onClick={() => openSheetForSlot(court.id, hour)}
                  />
                ),
              )
            ),
          )}

          {visibleBookings.map((booking) => {
            const rowStart = gridRowForInstant(booking.startAt)
            const rowEnd = gridRowForInstant(booking.endAt)
            const colIndex = courts.findIndex((c) => c.id === booking.courtId)
            if (colIndex < 0) return null
            return (
              <div
                key={booking.id}
                className={`booking ${bookingColorClass(booking)}`}
                style={{ gridColumn: colIndex + 2, gridRow: `${rowStart}/${rowEnd}` }}
                onClick={() => navigate(`/units/${unitId}/bookings/${booking.id}`, { state: { booking } })}
              >
                <b>{bookingTitle(booking)}</b>
                <span className="bmeta">
                  {booking.teacherName ? `Prof. ${booking.teacherName}` : bookingTypeLabel(booking.type)}
                </span>
              </div>
            )
          })}

          {nowTopPx !== null ? <div className="now-line" style={{ top: `${nowTopPx}px` }} /> : null}
        </div>
      </div>

      {!viewOnly ? (
        <button className="fab" aria-label="Nova reserva" onClick={openSheetForFab}>
          +
        </button>
      ) : null}

      <NovaReservaSheet
        key={sheetKey}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        unitId={unitId ?? ''}
        courts={courts}
        prefill={sheetPrefill}
        onCreated={reloadBookings}
      />
    </AppShell>
  )
}
