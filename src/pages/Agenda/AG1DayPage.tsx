import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AgendaDesktop } from '../../components/AgendaDesktop/AgendaDesktop'
import { AgendaMobile } from '../../components/AgendaMobile/AgendaMobile'
import { EmptyState } from '../../components/ui/EmptyState/EmptyState'
import { Input } from '../../components/ui/Input/Input'
import { getBookingsGrid, type Booking } from '../../lib/api/bookings'
import { listCourts, type Court } from '../../lib/api/courts'
import {
  bookingTitle,
  bookingTone,
  bookingTypeLabel,
  dayWindow,
  formatHM,
  formatISODate,
  formatShortRange,
  formatWeekdayDate,
  GRID_END_HOUR,
  GRID_START_HOUR,
  HOURS,
  isSameDay,
  LEGEND_TONE_ITEMS,
  matchesSearch,
  novaReservaPath,
  weekDaysSunday,
} from './agendaShared'
import './AG1DayPage.css'

/**
 * AG1 — Calendário Dia (BEAC-1903, story BEAC-1704), reskinado em 2026-08
 * contra os frames "02 · Agenda — Admin — Mobile" (5:217), "02b · …Vazio"
 * (188:2111) e "04 · Agenda — Admin — Desktop" (81:1109) do protótipo
 * hb7PA0Xx3L7iHjt9AfHsGK.
 *
 * A tela NÃO tem mais markup de grade próprio: ela COMPÕE os dois
 * componentes que já tinham sido construídos a partir do Figma e estavam
 * sem consumidor nenhum — `AgendaMobile` (timeline de um dia + tira de
 * dias + filtro de quadra) e `AgendaDesktop` (grade hora x quadra). Foi
 * exatamente esse divórcio (componente feito do protótipo, tela feita à
 * mão, os dois divergindo) que já custou caro em MatchCard/Medal/
 * BracketRoundHeader. As props que faltavam para cobrir o comportamento já
 * entregue por esta tela (slot livre clicável, coluna em manutenção, linha
 * do "agora", busca, toggle Dia|Semana) foram adicionadas AOS
 * COMPONENTES, de forma aditiva — ver os comentários de módulo dos dois.
 *
 * Os dois são renderizados sempre e o CSS (AG1DayPage.css, breakpoint
 * BREAKPOINT_SHELL_DESKTOP_MIN) esconde um dos dois — mesmo padrão de
 * F5MyInvoicesPage (cards no mobile / tabela no desktop): sem `matchMedia`,
 * sem flash de layout na primeira pintura.
 *
 * Quadras como colunas no desktop (uma por quadra da unit, incluindo as em
 * manutenção — ver comentário de ../../lib/api/courts.ts sobre por que o
 * overlay de bloqueio precisa da quadra aparecer mesmo sem nenhuma
 * reserva); no mobile as quadras viram chips de filtro e o dia inteiro cabe
 * numa timeline única, como no frame.
 */
export default function AG1DayPage() {
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
  // Filtro de quadra do frame mobile (chips). Lista VAZIA = nenhum filtro
  // (todas as quadras aparecem, nenhum chip aceso) — é o estado inicial e o
  // que o frame desenha: chip aceso significa "estou filtrando por esta",
  // não "esta está ligada". Sem isso a tela abriria com todos os chips
  // pintados de escuro, que lê como seleção deliberada do usuário.
  const [courtFilter, setCourtFilter] = useState<string[]>([])

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
  //
  // `mountedRef.current = true` no CORPO do efeito, não só no valor inicial
  // do ref: em dev o StrictMode monta -> desmonta -> monta a MESMA
  // instância, e a limpeza da primeira passagem deixava o ref em `false`
  // para sempre — todo fetch subsequente era descartado e a agenda ficava
  // permanentemente vazia rodando `bun run dev` (defeito só de dev,
  // encontrado no QA visual desta tela).
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

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


  /** Reservas do dia no formato dos dois componentes de agenda. */
  const desktopEvents = useMemo(
    () =>
      visibleBookings.map((booking) => {
        const title = bookingTitle(booking)
        const subtitle = booking.teacherName
          ? `Prof. ${booking.teacherName}`
          : bookingTypeLabel(booking.type)
        return {
          id: booking.id,
          courtId: booking.courtId,
          title,
          // Bloqueio cujo `reason` é literalmente "Bloqueio" cairia em
          // "Bloqueio / Bloqueio" (título = motivo, subtítulo = rótulo do
          // tipo) — repetir a mesma palavra em duas linhas não informa nada.
          subtitle: subtitle === title ? undefined : subtitle,
          start: formatHM(booking.startAt),
          end: formatHM(booking.endAt),
          status: bookingTone(booking),
        }
      }),
    [visibleBookings],
  )

  // No mobile a timeline é UMA só (não há coluna por quadra), então o chip
  // de quadra é o que decide o que aparece — e o nome da quadra vira o
  // subtítulo do card, que no desktop já está implícito na coluna.
  const mobileEvents = useMemo(
    () =>
      desktopEvents
        .filter((event) => courtFilter.length === 0 || courtFilter.includes(event.courtId))
        .map((event) => ({
          ...event,
          subtitle:
            [courts.find((c) => c.id === event.courtId)?.name, event.subtitle]
              .filter(Boolean)
              .join(' · ') || undefined,
        })),
    [desktopEvents, courtFilter, courts],
  )

  // Horas sem nenhuma reserva das quadras visíveis — o chip tracejado
  // "+ Avulsa" do frame (163:5385). O frame também mostra o PREÇO do slot
  // ("+ Avulsa · R$ 90"); nenhum endpoint da agenda devolve preço de
  // horário avulso, então o rótulo vai sem ele (ver relatório da tela).
  const mobileFreeSlots = useMemo(() => {
    if (viewOnly) return []
    const busy = new Set(
      mobileEvents.flatMap((event) => {
        const start = Number(event.start.slice(0, 2))
        const end = Number(event.end.slice(0, 2))
        return HOURS.filter((hour) => hour >= start && hour < Math.max(end, start + 1))
      }),
    )
    return HOURS.filter((hour) => !busy.has(hour)).map((hour) => ({
      hour,
      label: '+ Avulsa',
    }))
  }, [mobileEvents, viewOnly])

  function goWeek() {
    navigate(`/units/${unitId}/agenda/semana?date=${date.toISOString().slice(0, 10)}`)
  }

  function changeDay(delta: number) {
    const next = new Date(date)
    next.setDate(next.getDate() + delta)
    setDate(next)
  }

  // AG6 "Nova reserva" é uma PÁGINA irmã desta rota, não mais um bottom sheet
  // (ver AG6NovaReservaPage.tsx). O que era prop `prefill` viaja pela URL, e
  // `from=dia&fromDate=` é o que faz a tela saber voltar para ESTE dia nesta
  // visão. Navegar daqui desmonta esta página; ao voltar ela remonta e o
  // efeito de `reloadBookings` re-busca o grid sozinho — era para isso que
  // servia a antiga prop `onCreated`.
  function goNovaReservaForSlot(courtId: string | undefined, hour: number) {
    if (viewOnly) return
    navigate(novaReservaPath(unitId ?? '', { courtId, date, startHour: hour, from: 'dia', fromDate: date }))
  }

  function goNovaReservaForFab() {
    navigate(novaReservaPath(unitId ?? '', { date, from: 'dia', fromDate: date }))
  }

  function openBooking(bookingId: string) {
    const booking = bookings.find((b) => b.id === bookingId)
    navigate(`/units/${unitId}/bookings/${bookingId}`, { state: { booking } })
  }

  const today = isSameDay(date, new Date())
  const dateLabel = `${today ? 'Hoje · ' : ''}${formatWeekdayDate(date)}`
  const weekDays = weekDaysSunday(date)
  const rangeLabel = formatShortRange(weekDays[0]!, weekDays[6]!)
  const nowMinutes = today ? now.getHours() * 60 + now.getMinutes() : null

  const searchInput = (
    <Input
      type="search"
      ariaLabel="Buscar por aluno, professor ou quadra"
      placeholder="🔍 Buscar"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
    />
  )

  return (
    <div className="ag1-page">
      {loadError ? <p role="alert">{loadError}</p> : null}

      <div className="ag1-page__mobile">
        <AgendaMobile
          viewOptions={['Dia', 'Semana']}
          view="Dia"
          onViewChange={(option) => {
            if (option === 'Semana') goWeek()
          }}
          headerExtra={searchInput}
          rangeLabel={rangeLabel}
          onPrevWeek={() => changeDay(-7)}
          onNextWeek={() => changeDay(7)}
          days={weekDays.map((day) => ({ date: formatISODate(day) }))}
          selectedDate={formatISODate(date)}
          onSelectDate={(iso) => setDate(new Date(`${iso}T00:00:00`))}
          courts={courts.map((court) => ({ id: court.id, label: court.name, sport: court.sport }))}
          selectedCourtIds={courtFilter}
          onToggleCourt={(courtId) =>
            setCourtFilter((prev) =>
              prev.includes(courtId) ? prev.filter((id) => id !== courtId) : [...prev, courtId],
            )
          }
          legend={LEGEND_TONE_ITEMS}
          events={mobileEvents}
          onSelectEvent={openBooking}
          freeSlots={mobileFreeSlots}
          onSelectFreeSlot={(hour) => goNovaReservaForSlot(undefined, hour)}
          emptyState={
            <EmptyState
              icon="🗓"
              title="Sem aulas hoje"
              description="A agenda de hoje está livre. Reservas novas aparecem aqui."
            />
          }
          action={viewOnly ? undefined : { label: '+ Nova reserva', onClick: goNovaReservaForFab }}
          startHour={GRID_START_HOUR}
          endHour={GRID_END_HOUR}
        />
      </div>

      <div className="ag1-page__desktop">
        <AgendaDesktop
          rangeLabel={dateLabel}
          onPrevDay={() => changeDay(-1)}
          onNextDay={() => changeDay(1)}
          viewOptions={['Dia', 'Semana']}
          view="Dia"
          onViewChange={(option) => {
            if (option === 'Semana') goWeek()
          }}
          headerExtra={searchInput}
          courts={courts.map((court) => ({
            id: court.id,
            label: court.name,
            sport: court.sport,
            blockedLabel: court.status === 'maintenance' ? 'Manutenção até sexta' : undefined,
          }))}
          legend={LEGEND_TONE_ITEMS}
          events={desktopEvents}
          onSelectEvent={openBooking}
          onSelectSlot={goNovaReservaForSlot}
          slotsDisabled={viewOnly}
          actionLabel={viewOnly ? null : '+ Nova reserva'}
          onNewBooking={goNovaReservaForFab}
          nowMinutes={nowMinutes}
          startHour={GRID_START_HOUR}
          endHour={GRID_END_HOUR}
        />
      </div>
    </div>
  )
}
