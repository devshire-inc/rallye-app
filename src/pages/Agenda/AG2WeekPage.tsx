import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AgendaDesktop } from '../../components/AgendaDesktop/AgendaDesktop'
import { AgendaMobile, weekdayOverline } from '../../components/AgendaMobile/AgendaMobile'
import { Input } from '../../components/ui/Input/Input'
import { Select } from '../../components/ui/Select/Select'
import { getBookingsGrid, type Booking } from '../../lib/api/bookings'
import { listCourts, type Court } from '../../lib/api/courts'
import { sportLabel } from '../../lib/sports'
import {
  bookingTitle,
  bookingTone,
  bookingTypeLabel,
  formatHour,
  formatISODate,
  formatShortRange,
  gridRowForInstant,
  HOURS,
  isSameDay,
  matchesSearch,
  novaReservaPath,
  WEEK_LEGEND_TONE_ITEMS,
  weekDaysSunday,
  weekWindowSunday,
} from './agendaShared'
import './AG2WeekPage.css'

/**
 * AG2 — Calendário Semana (BEAC-1903, story BEAC-1704), reskinada em 2026-08
 * contra os frames "24 · Agenda Semana — Admin — Mobile" (157:4330) e
 * "24 · Agenda — Semana — Admin — Desktop" (165:4881) do protótipo
 * hb7PA0Xx3L7iHjt9AfHsGK.
 *
 * DECISÃO DE COMPONENTE (medida, ver relatório da tela). A tela COMPÕE
 * `AgendaMobile`/`AgendaDesktop` para todo o cromo e mantém markup próprio só
 * para a GRADE. Os dois componentes foram construídos para UM DIA (timeline por
 * hora, grade hora x quadra) e a semana é outro eixo — mas o cromo dos frames
 * da semana é, bloco a bloco, o mesmo dos frames do dia:
 *
 *   mobile (157:4330)  : título 32px + navegador ‹ "26 jul – 1 ago" › +
 *                        legenda de status + [corpo] + "+ Nova reserva" de
 *                        largura cheia         -> 4 dos 5 blocos são AgendaMobile
 *   desktop (165:4881) : cabeçalho (título + navegador + toggle Dia|Semana) +
 *                        linha de legenda com "+ Nova reserva" à direita +
 *                        [corpo]               -> 2 dos 3 blocos são AgendaDesktop
 *
 * `rangeLabel` é literalmente o mesmo texto dos dois frames ("26 jul – 1 ago",
 * `formatShortRange`), o que confirma que é o MESMO navegador, não um parecido.
 * Reimplementar esse cromo aqui seria a divergência silenciosa que já custou
 * MatchCard/Medal/BracketRoundHeader e que 0abc631 desfez.
 *
 * A grade NÃO virou prop dos componentes: transformar "coluna = quadra" em
 * "coluna = dia" exigiria header de coluna alternativo + rótulo acessível
 * alternativo + `sport` opcional + marca de "hoje", ou seja reescrever o miolo
 * de um componente com dois consumidores reais que não podem mudar de
 * aparência — e contraria a decisão travada do dispatch ("AG1 e AG2 são
 * estruturalmente diferentes... NUNCA uma variação de props de um componente").
 * O que os dois componentes ganharam é só o escape hatch de corpo alternativo,
 * aditivo e com default = comportamento atual: `children` em AgendaDesktop (o
 * AgendaMobile já tinha, de AG4) e `showWeekStrip` em AgendaMobile.
 *
 * Efeito colateral bom da composição: a grade fica DENTRO de
 * `.agenda-mobile`/`.agenda-desktop`, então herda a paleta `[data-tone]` das
 * duas folhas — inclusive a alternância de tom de texto entre claro e escuro
 * que 0abc631 mediu e que não é reproduzível por custom property inline.
 *
 * Estrutura de dados da tela (inalterada): 1 QUADRA por vez (dropdown no
 * cabeçalho) x 7 DIAS como colunas. É o eixo oposto de AG1, e é o que torna a
 * escolha de quadra obrigatória — uma grade dia x quadra x hora não caberia em
 * duas dimensões.
 *
 * DESVIOS DELIBERADOS DOS FRAMES (nenhum é estética nova; todos preservam
 * comportamento já entregue que os frames não desenham — mesmo critério do
 * `headerExtra` de busca em AG1):
 *
 * - dropdown de QUADRA e campo de BUSCA vão no `headerExtra`. Sem o dropdown a
 *   tela não tem o que desenhar (ver acima); a busca é AC comum de AG1/AG2.
 * - toggle Dia|Semana também no MOBILE. O frame mobile da semana não o desenha
 *   (o do dia, 5:217, desenha), e sem ele o usuário de celular entra na semana
 *   e não tem volta para o dia — regressão de navegação, não reskin.
 * - rodapé de stats (Ocupação/Horários livres/Receita) não existe nos frames e
 *   continua: são AC desta tela. Fica no corpo, abaixo da grade.
 * - a grade vai de 6h a 21h (GRID_START_HOUR/GRID_END_HOUR, AC "06h-22h"); os
 *   frames desenham 6h-18h, que é o recorte do mock, não uma janela nova.
 */

/** Rótulo do affordance de horário livre — o "+" tracejado do frame desktop
 * (169:3180) e o chip "+ Vago" do frame mobile (212:2233). */
const FREE_SLOT_LABEL = { mobile: '+ Vago', desktop: '+' } as const

interface WeekGridProps {
  variant: 'mobile' | 'desktop'
  days: Date[]
  bookings: Booking[]
  viewOnly: boolean
  onSelectSlot: (dayIndex: number, hour: number) => void
  onSelectBooking: (booking: Booking) => void
  /** Minutos desde 00:00 do "agora", ou null quando a semana exibida não
   * contém hoje (ou quando a variante não desenha a linha). */
  nowMinutes: number | null
}

/**
 * A grade dia x hora dos dois frames. Vive aqui, junto do seu único
 * consumidor, e não em `src/components`: componente de agenda construído
 * contra o Figma e deixado sem tela é o erro que esta sessão já cometeu três
 * vezes (MatchCard, Medal, BracketRoundHeader).
 *
 * As duas variantes são o MESMO JSX; o que muda (largura de coluna, altura de
 * linha, tipografia, subtítulo visível ou não) é só CSS, em
 * `.ag2-week--mobile`/`.ag2-week--desktop`. Posição na grade viaja por custom
 * property, nunca por `style` com chave literal de CSS — mesmo padrão de
 * AgendaMobile/AgendaDesktop, e o que permite às duas variantes reaproveitarem
 * a marcação sem que o JS conheça pixel nenhum.
 */
function WeekGrid({
  variant,
  days,
  bookings,
  viewOnly,
  onSelectSlot,
  onSelectBooking,
  nowMinutes,
}: WeekGridProps) {
  const today = new Date()
  const gridStyle = { '--ag2-hour-count': `${HOURS.length}` } as CSSProperties

  /* Linha do "agora": em que faixa de hora cai e a que altura dentro dela.
   * Fora da janela [GRID_START_HOUR, GRID_END_HOUR) não há linha — a grade não
   * desenha aquele horário. */
  const nowRow =
    nowMinutes !== null && nowMinutes >= HOURS[0]! * 60 && nowMinutes < (HOURS.at(-1)! + 1) * 60
      ? {
          row: 2 + Math.floor(nowMinutes / 60) - HOURS[0]!,
          frac: (nowMinutes % 60) / 60,
          label: `${String(Math.floor(nowMinutes / 60)).padStart(2, '0')}:${String(nowMinutes % 60).padStart(2, '0')}`,
        }
      : null

  /** Reservas por dia, para decidir se a célula está livre e onde cada bloco
   * cai. `findIndex` por dia evita comparar strings de data. */
  const dayIndexOf = (iso: string): number => {
    const start = new Date(iso)
    return days.findIndex((day) => isSameDay(day, start))
  }

  const occupied = new Set<string>()
  for (const booking of bookings) {
    const dayIndex = dayIndexOf(booking.startAt)
    if (dayIndex < 0) continue
    const startHour = new Date(booking.startAt).getHours()
    const endHour = new Date(booking.endAt).getHours()
    for (const hour of HOURS) {
      if (hour >= startHour && hour < Math.max(endHour, startHour + 1)) occupied.add(`${dayIndex}-${hour}`)
    }
  }

  return (
    <div className={`ag2-week ag2-week--${variant}`}>
      <div className="ag2-week__scroll">
        <div className="ag2-week__grid" style={gridStyle} role="group" aria-label="Grade de horários por dia da semana">
          <div className="ag2-week__corner" aria-hidden="true" />

          {days.map((day, dayIndex) => (
            <div
              key={formatISODate(day)}
              className="ag2-week__day-head"
              style={{ '--ag2-col': `${dayIndex + 2}` } as CSSProperties}
              data-today={isSameDay(day, today) ? 'true' : undefined}
            >
              <span className="ag2-week__day-name">{weekdayOverline(day)}</span>
              <span className="ag2-week__day-number">{day.getDate()}</span>
            </div>
          ))}

          {HOURS.map((hour, hourIndex) => {
            const rowStyle = { '--ag2-row': `${hourIndex + 2}` } as CSSProperties
            return (
              <span className="ag2-week__hour" style={rowStyle} key={`hour-${hour}`}>
                {formatHour(hour)}
              </span>
            )
          })}
          {HOURS.map((hour, hourIndex) => (
            <div
              className="ag2-week__hour-line"
              style={{ '--ag2-row': `${hourIndex + 2}` } as CSSProperties}
              aria-hidden="true"
              key={`line-${hour}`}
            />
          ))}

          {days.map((day, dayIndex) =>
            HOURS.map((hour, hourIndex) => {
              if (occupied.has(`${dayIndex}-${hour}`)) return null
              const cellStyle = {
                '--ag2-col': `${dayIndex + 2}`,
                '--ag2-row': `${hourIndex + 2}`,
              } as CSSProperties
              return (
                <div
                  key={`cell-${dayIndex}-${hour}`}
                  className="ag2-week__cell"
                  style={cellStyle}
                  role="button"
                  tabIndex={viewOnly ? -1 : 0}
                  aria-label={`Horário livre ${weekdayOverline(day)} ${day.getDate()} ${formatHour(hour)}`}
                  aria-disabled={viewOnly}
                  onClick={() => onSelectSlot(dayIndex, hour)}
                >
                  {viewOnly ? null : (
                    <span className="ag2-week__cell-affordance" aria-hidden="true">
                      {FREE_SLOT_LABEL[variant]}
                    </span>
                  )}
                </div>
              )
            }),
          )}

          {bookings.map((booking) => {
            const dayIndex = dayIndexOf(booking.startAt)
            if (dayIndex < 0) return null
            const title = bookingTitle(booking)
            const subtitle = booking.teacherName
              ? `Prof. ${booking.teacherName}`
              : bookingTypeLabel(booking.type)
            const blockStyle = {
              '--ag2-col': `${dayIndex + 2}`,
              '--ag2-row-start': `${gridRowForInstant(booking.startAt)}`,
              '--ag2-row-end': `${gridRowForInstant(booking.endAt)}`,
            } as CSSProperties
            return (
              <button
                type="button"
                key={booking.id}
                className="ag2-week__booking"
                data-tone={bookingTone(booking)}
                style={blockStyle}
                data-testid={`ag2-week-booking-${variant}-${booking.id}`}
                onClick={() => onSelectBooking(booking)}
              >
                <span className="ag2-week__booking-title">{title}</span>
                {/* Bloqueio cujo `reason` é literalmente "Bloqueio" cairia em
                    "Bloqueio / Bloqueio" — mesma regra de AG1DayPage. */}
                {subtitle === title ? null : (
                  <span className="ag2-week__booking-subtitle">{subtitle}</span>
                )}
              </button>
            )
          })}

          {nowRow ? (
            <div
              className="ag2-week__now"
              style={
                { '--ag2-row': `${nowRow.row}`, '--ag2-now-frac': `${nowRow.frac}` } as CSSProperties
              }
              aria-hidden="true"
            >
              <span className="ag2-week__now-label">{nowRow.label}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function AG2WeekPage() {
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
  const [now, setNow] = useState(new Date())

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

  // Semana DOMINGO a SÁBADO, não segunda a domingo: é o que os dois frames
  // desenham ("DOM 26 … SÁB 1", e o rótulo "26 jul – 1 ago" é o domingo 26/07
  // ao sábado 01/08 de 2026), e é a mesma convenção da weekStrip de AG1/AG4
  // (`weekDaysSunday`). A janela de busca acompanha as colunas por definição —
  // buscar seg-dom e desenhar dom-sáb mostraria uma semana com dois dias sem
  // dado e um dia de dado sem coluna.
  const { from, to } = useMemo(() => weekWindowSunday(anchorDate), [anchorDate])
  const weekDays = useMemo(() => weekDaysSunday(anchorDate), [anchorDate])

  // Guarda contra setState depois de desmontar.
  //
  // `mountedRef.current = true` no CORPO do efeito, não só no valor inicial do
  // ref: em dev o StrictMode monta -> desmonta -> monta a MESMA instância, e a
  // limpeza da primeira passagem deixava o ref em `false` para sempre — todo
  // `setBookings` era descartado e a semana abria permanentemente vazia rodando
  // `bun run dev`. Mesmo defeito, e mesma correção de uma linha, de AG1DayPage
  // (0abc631) e AG4TeacherAgendaPage (fd4b759).
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

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

  // Linha do "agora" atualizada ao vivo, como em AG1DayPage. 60s é
  // granularidade suficiente para uma grade de faixas de 1h.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const visibleBookings = useMemo(
    () => bookings.filter((b) => matchesSearch(b, search)),
    [bookings, search],
  )

  function goDay() {
    navigate(`/units/${unitId}/agenda?date=${formatISODate(anchorDate)}`)
  }

  function changeWeek(delta: number) {
    const next = new Date(anchorDate)
    next.setDate(next.getDate() + delta * 7)
    setAnchorDate(next)
  }

  // AG6 "Nova reserva" é uma PÁGINA irmã desta rota, não mais um bottom sheet
  // (ver AG6NovaReservaPage.tsx). `from=semana&fromDate=` é o que devolve o
  // usuário para ESTA semana nesta visão — sem isso ele cairia na Agenda do
  // dia de hoje, que não é de onde ele veio. `fromDate` é o `anchorDate` (a
  // semana visível), não o dia do slot: são coisas diferentes na ação do
  // rodapé, que não pré-preenche data nenhuma.
  function goNovaReservaForSlot(dayIndex: number, hour: number) {
    if (viewOnly) return
    navigate(
      novaReservaPath(unitId ?? '', {
        courtId: selectedCourtId,
        date: weekDays[dayIndex],
        startHour: hour,
        from: 'semana',
        fromDate: anchorDate,
      }),
    )
  }

  function goNovaReserva() {
    navigate(
      novaReservaPath(unitId ?? '', {
        courtId: selectedCourtId,
        from: 'semana',
        fromDate: anchorDate,
      }),
    )
  }

  function openBooking(booking: Booking) {
    navigate(`/units/${unitId}/bookings/${booking.id}`, { state: { booking } })
  }

  // Stats "em tempo real" (AC: "Ocupação da semana", "Horários livres",
  // "Receita da quadra") — os dois primeiros são deriváveis de verdade da
  // janela de bookings confirmados desta quadra. "Receita" NÃO tem dado real
  // disponível: nenhuma tabela deste schema (courts/classes/bookings,
  // migrations 000032/000033/000034) modela preço/valor de reserva. Mostrar um
  // valor calculado aqui seria inventar dado, então aparece como indisponível
  // em vez de um número fictício.
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

  const rangeLabel = formatShortRange(weekDays[0]!, weekDays[6]!)

  /* A linha do "agora" só existe se a semana exibida for a semana de hoje — em
   * qualquer outra semana ela apontaria para um horário que não é daquela
   * semana. O frame mobile (157:4330) não a desenha, então `body('mobile')`
   * passa null. */
  const nowMinutes = weekDays.some((day) => isSameDay(day, now))
    ? now.getHours() * 60 + now.getMinutes()
    : null

  /* Dropdown de quadra + busca: o `headerExtra` dos dois componentes. O rótulo
   * da opção usa `sportLabel`, nunca `court.sport` cru — o slug do banco
   * ("Q1 · beach_tennis") vazando para a UI é o mesmo defeito corrigido em
   * a983267. */
  const headerControls = (
    <>
      <Select
        ariaLabel="Quadra"
        value={selectedCourtId}
        onChange={(e) => setSelectedCourtId(e.target.value)}
        options={courts.map((court) => ({
          value: court.id,
          label: `${court.name} · ${sportLabel(court.sport)}`,
        }))}
      />
      <Input
        type="search"
        ariaLabel="Buscar por aluno, professor ou quadra"
        placeholder="🔍 Buscar"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
    </>
  )

  function body(variant: 'mobile' | 'desktop') {
    return (
      <>
        <WeekGrid
          variant={variant}
          days={weekDays}
          bookings={visibleBookings}
          viewOnly={viewOnly}
          onSelectSlot={goNovaReservaForSlot}
          onSelectBooking={openBooking}
          nowMinutes={variant === 'desktop' ? nowMinutes : null}
        />
        <dl className="ag2-stats">
          <div className="ag2-stats__item">
            <dt>Ocupação da semana</dt>
            <dd>{`${occupancyPercent}%`}</dd>
          </div>
          <div className="ag2-stats__item">
            <dt>Horários livres</dt>
            <dd>{freeSlots}</dd>
          </div>
          <div className="ag2-stats__item">
            <dt>Receita da quadra</dt>
            <dd title="O sistema ainda não registra valor de reserva.">indisponível</dd>
          </div>
        </dl>
      </>
    )
  }

  return (
    <div className="ag2-page">
      {loadError ? <p role="alert">{loadError}</p> : null}

      <div className="ag2-page__mobile">
        <AgendaMobile
          viewOptions={['Dia', 'Semana']}
          view="Semana"
          onViewChange={(option) => {
            if (option === 'Dia') goDay()
          }}
          headerExtra={headerControls}
          rangeLabel={rangeLabel}
          onPrevWeek={() => changeWeek(-1)}
          onNextWeek={() => changeWeek(1)}
          days={weekDays.map((day) => ({ date: formatISODate(day) }))}
          showWeekStrip={false}
          selectedDate={formatISODate(anchorDate)}
          courts={[]}
          selectedCourtIds={[]}
          legend={WEEK_LEGEND_TONE_ITEMS}
          events={[]}
          action={viewOnly ? undefined : { label: '+ Nova reserva', onClick: goNovaReserva }}
        >
          {body('mobile')}
        </AgendaMobile>
      </div>

      <div className="ag2-page__desktop">
        <AgendaDesktop
          rangeLabel={rangeLabel}
          onPrevDay={() => changeWeek(-1)}
          onNextDay={() => changeWeek(1)}
          prevLabel="Semana anterior"
          nextLabel="Próxima semana"
          viewOptions={['Dia', 'Semana']}
          view="Semana"
          onViewChange={(option) => {
            if (option === 'Dia') goDay()
          }}
          headerExtra={headerControls}
          courts={[]}
          legend={WEEK_LEGEND_TONE_ITEMS}
          events={[]}
          actionLabel={viewOnly ? null : '+ Nova reserva'}
          onNewBooking={goNovaReserva}
        >
          {body('desktop')}
        </AgendaDesktop>
      </div>
    </div>
  )
}
