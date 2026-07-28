import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell/AppShell'
import { IconButton } from '../../components/ui/IconButton/IconButton'
import { Input } from '../../components/ui/Input/Input'
import { Segmented } from '../../components/ui/Segmented/Segmented'
import { Select } from '../../components/ui/Select/Select'
import { useShellIdentity } from '../../hooks/useShellIdentity'
import { getBookingsGrid, type Booking } from '../../lib/api/bookings'
import { listCourts, type Court } from '../../lib/api/courts'
import {
  bookingColorClass,
  bookingTitle,
  bookingTypeLabel,
  formatHour,
  formatWeekLabel,
  gridRowForInstant,
  HOURS,
  isSameDay,
  LEGEND_ITEMS,
  matchesSearch,
  weekWindow,
  WEEKDAY_SHORT_LABELS,
} from './agendaShared'
import { NovaReservaSheet, type NovaReservaPrefill } from './NovaReservaSheet'
import '../../components/AuthLayout/AuthLayout.css'
import './Agenda.css'

/**
 * AG2 — Calendário Semana (BEAC-1903, story BEAC-1704). Estrutura
 * DELIBERADAMENTE diferente de AG1DayPage (decisão travada do dispatch):
 * aqui é 1 quadra por vez (dropdown no header) x 7 dias da semana como
 * colunas — não quadras como colunas. Markup/classes copiados do protótipo
 * real (scr-ag2, artifact "Rallye — Agenda", linhas 611-658 lidas
 * integralmente antes de implementar): `.week-grid`, `.wk-stats`, dropdown de
 * quadra no `.ag-head`, dia atual destacado via `.head.today`.
 */
export default function AG2WeekPage() {
  const { orgLabel, userLabel } = useShellIdentity()
  const { unitId } = useParams<{ unitId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const initialDate = searchParams.get('date') ? new Date(searchParams.get('date')!) : new Date()
  const [anchorDate, setAnchorDate] = useState(initialDate)
  const [courts, setCourts] = useState<Court[]>([])
  const [selectedCourtId, setSelectedCourtId] = useState('')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [viewOnly, setViewOnly] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetPrefill, setSheetPrefill] = useState<NovaReservaPrefill | undefined>(undefined)
  const [sheetKey, setSheetKey] = useState(0)

  useEffect(() => {
    if (!unitId) return
    let cancelled = false
    listCourts(unitId).then((result) => {
      if (cancelled || !result.ok) return
      setCourts(result.courts)
      setSelectedCourtId((prev) => prev || result.courts[0]?.id || '')
    })
    return () => {
      cancelled = true
    }
  }, [unitId])

  const { from, to, monday } = useMemo(() => weekWindow(anchorDate), [anchorDate])

  // Guarda contra setState depois de desmontar — ver mesmo comentário em
  // AG1DayPage.tsx.
  const mountedRef = useRef(true)
  useEffect(
    () => () => {
      mountedRef.current = false
    },
    [],
  )

  const reloadBookings = useCallback(() => {
    if (!unitId || !selectedCourtId) return
    getBookingsGrid(unitId, from, to, selectedCourtId)
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
  }, [unitId, selectedCourtId, from, to])

  useEffect(() => {
    reloadBookings()
  }, [reloadBookings])

  const visibleBookings = useMemo(
    () => bookings.filter((b) => matchesSearch(b, search)),
    [bookings, search],
  )

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)),
    [monday],
  )

  function goDay() {
    navigate(`/units/${unitId}/agenda?date=${anchorDate.toISOString().slice(0, 10)}`)
  }

  function changeWeek(delta: number) {
    const next = new Date(anchorDate)
    next.setDate(next.getDate() + delta * 7)
    setAnchorDate(next)
  }

  function openSheetForSlot(dayIndex: number, hour: number) {
    if (viewOnly) return
    setSheetPrefill({ courtId: selectedCourtId, date: weekDays[dayIndex], startHour: hour })
    setSheetKey((k) => k + 1)
    setSheetOpen(true)
  }

  // Stats "em tempo real" (AC: "Ocupação da semana", "Horários livres",
  // "Receita da quadra") — os dois primeiros são deriváveis de verdade da
  // janela de bookings confirmados desta quadra. "Receita" NÃO tem dado real
  // disponível: nenhuma tabela deste schema (courts/classes/bookings,
  // migrations 000032/000033/000034) modela preço/valor de reserva — não
  // existe um conceito de "receita" persistido em lugar nenhum ainda (gap
  // financeiro, provavelmente um épico futuro). Mostrar um valor calculado
  // aqui seria inventar dado — reportado como questão em aberto no relatório
  // de dispatch, exibido como indisponível em vez de um número fictício.
  const totalSlots = 7 * HOURS.length
  const occupiedSlots = bookings
    .filter((b) => b.status === 'confirmed')
    .reduce((sum, b) => {
      const startHour = new Date(b.startAt).getHours()
      const endHour = new Date(b.endAt).getHours()
      return sum + Math.max(1, endHour - startHour)
    }, 0)
  const occupancyPercent = totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0
  const freeSlots = Math.max(0, totalSlots - occupiedSlots)

  return (
    <AppShell orgLabel={orgLabel} userLabel={userLabel}>
      <div className="ag-head">
        <h1>Agenda</h1>
        <div className="spacer" />
        <div className="date-nav">
          <IconButton variant="secondary" size="sm" label="Semana anterior" onClick={() => changeWeek(-1)}>
            ‹
          </IconButton>
          <span className="dlabel">{formatWeekLabel(monday)}</span>
          <IconButton variant="secondary" size="sm" label="Próxima semana" onClick={() => changeWeek(1)}>
            ›
          </IconButton>
        </div>
        <Segmented
          ariaLabel="Alternar entre visão Dia e Semana"
          options={['Dia', 'Semana']}
          value="Semana"
          onChange={(option) => {
            if (option === 'Dia') goDay()
          }}
        />
        <Select
          ariaLabel="Quadra"
          value={selectedCourtId}
          onChange={(e) => setSelectedCourtId(e.target.value)}
          options={courts.map((court) => ({ value: court.id, label: `${court.name} · ${court.sport}` }))}
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
        <div className="week-grid" style={{ gridTemplateColumns: '64px repeat(7, 1fr)' }}>
          <div className="head" />
          {weekDays.map((day, i) => (
            <div className={`head ${isSameDay(day, new Date()) ? 'today' : ''}`} key={i}>
              {WEEKDAY_SHORT_LABELS[i]}
              <small>
                {day.getDate()} {['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][day.getMonth()]}
              </small>
            </div>
          ))}

          {HOURS.map((hour) => (
            <div className="hr" key={hour}>
              {formatHour(hour)}
            </div>
          ))}

          {weekDays.map((day, dayIndex) =>
            HOURS.map((hour) => {
              const occupied = visibleBookings.some((b) => {
                const bStart = new Date(b.startAt)
                return (
                  bStart.getFullYear() === day.getFullYear() &&
                  bStart.getMonth() === day.getMonth() &&
                  bStart.getDate() === day.getDate() &&
                  bStart.getHours() <= hour &&
                  new Date(b.endAt).getHours() > hour
                )
              })
              if (occupied) return null
              return (
                <div
                  key={`${dayIndex}-${hour}`}
                  className="cal-cell"
                  data-newslot
                  role="button"
                  tabIndex={viewOnly ? -1 : 0}
                  aria-label={`Horário livre ${WEEKDAY_SHORT_LABELS[dayIndex]} ${formatHour(hour)}`}
                  aria-disabled={viewOnly}
                  style={{ gridColumn: dayIndex + 2 }}
                  onClick={() => openSheetForSlot(dayIndex, hour)}
                />
              )
            }),
          )}

          {visibleBookings.map((booking) => {
            const bStart = new Date(booking.startAt)
            const dayIndex = weekDays.findIndex(
              (d) =>
                d.getFullYear() === bStart.getFullYear() &&
                d.getMonth() === bStart.getMonth() &&
                d.getDate() === bStart.getDate(),
            )
            if (dayIndex < 0) return null
            const rowStart = gridRowForInstant(booking.startAt)
            const rowEnd = gridRowForInstant(booking.endAt)
            return (
              <div
                key={booking.id}
                className={`booking ${bookingColorClass(booking)}`}
                style={{ gridColumn: dayIndex + 2, gridRow: `${rowStart}/${rowEnd}` }}
                onClick={() => navigate(`/units/${unitId}/bookings/${booking.id}`, { state: { booking } })}
              >
                <b>{bookingTitle(booking)}</b>
                <span className="bmeta">
                  {booking.teacherName ? `Prof. ${booking.teacherName}` : bookingTypeLabel(booking.type)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="wk-stats">
        <span>
          Ocupação da semana: <b>{occupancyPercent}%</b>
        </span>
        <span>
          Horários livres: <b>{freeSlots}</b>
        </span>
        <span>
          Receita da quadra: <b title="Sem dado de preço/valor no schema atual — ver relatório de dispatch">indisponível</b>
        </span>
      </div>

      {!viewOnly ? (
        <button
          className="fab"
          aria-label="Nova reserva"
          onClick={() => {
            setSheetPrefill({ courtId: selectedCourtId })
            setSheetKey((k) => k + 1)
            setSheetOpen(true)
          }}
        >
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
