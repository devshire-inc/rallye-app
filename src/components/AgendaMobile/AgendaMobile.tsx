import type { CSSProperties, ReactNode } from 'react'
import { Button } from '../ui/Button/Button'
import { IconButton } from '../ui/IconButton/IconButton'
import { Segmented } from '../ui/Segmented/Segmented'
import { sportCssVar } from '../../lib/sports'
import './AgendaMobile.css'

/**
 * AgendaMobile (Figma "Agenda — Mobile", node 63:2/63:6) — pattern novo,
 * composto de 4 sub-padrões que não existiam isoladamente no design system:
 * navegador de semana (navRow), tira de dias (weekStrip), chips de filtro
 * de quadra (filterRow) e timeline de horários do dia (timeline). Não é uma
 * variação de nenhum componente `ui/` existente — por isso vive fora de
 * `ui/` (mesmo precedente de AppShell/BottomSheet/AvailabilityGrid), e a
 * lista travada de `ui/inventory.test.ts` (20 nomes) não é tocada.
 *
 * 100% controlado via props + callbacks (mesmo padrão de TimePicker/
 * DatePicker/Segmented) — não busca dados nem possui estado de negócio;
 * quem usa decide a janela de datas, quais dias têm evento, quais quadras
 * existem e quais eventos aparecem na timeline do dia selecionado.
 *
 * ADAPTAÇÃO 2026-08 (reskin da Agenda, protótipo hb7PA0Xx3L7iHjt9AfHsGK):
 * o componente nasceu de um frame anterior ("Agenda — Mobile") e agora é
 * consumido pelas telas reais, cujos frames são "02 · Agenda — Admin —
 * Mobile" (5:217), "…— Vazio" (188:2111) e "03 · Agenda — Professor —
 * Mobile" (35:1096). O que mudou, tudo aditivo/retrocompatível:
 *
 * - props novas, todas opcionais: `title`, `viewOptions`/`view`/
 *   `onViewChange` (toggle Dia|Semana), `headerExtra`, `legend`, `action`,
 *   `freeSlots`/`onSelectFreeSlot`, `onSelectEvent`, `emptyState`;
 * - `AgendaMobileEvent.sport` e `AgendaMobileCourtFilter.sport` viraram
 *   OPCIONAIS, e o evento ganhou `status` — nos frames reais a cor do
 *   evento vem do STATUS da reserva (state/*-soft + state/*), não do
 *   esporte. Sem `status`, o comportamento antigo (cor por esporte) segue
 *   valendo, então nenhum consumidor/story anterior muda de aparência;
 * - tipografia realinhada aos frames reais: título 32px (--type-display,
 *   era --type-title/24px), rótulos de dia/chip/hora/evento em 13px
 *   (--type-label/--type-small, eram --type-overline/11px), e as células da
 *   weekStrip passaram a ter fundo `surface-card` + radius-lg como no frame
 *   (eram transparentes/radius-md).
 */

const WEEKDAY_OVERLINE = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

/** Minutos desde 00:00 para "HH:MM", ou null se o formato for inválido —
 * mesma regra de TimePicker.parseTime, duplicada localmente para este
 * componente não depender de internals de ui/TimePicker. */
export function parseHM(value: string): number | null {
  const match = TIME_RE.exec(value)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

/** "6h", "13h" — rótulo de linha de hora da timeline. */
export function formatHourLabel(hour: number): string {
  return `${hour}h`
}

/** Horas exibidas na timeline, [startHour, endHour) — limite superior
 * exclusivo (mesma convenção de GRID_END_HOUR em lib/agenda/AG1AG2). */
export function hoursInRange(startHour: number, endHour: number): number[] {
  if (endHour <= startHour) return []
  return Array.from({ length: endHour - startHour }, (_, i) => startHour + i)
}

/** "DOM"/"SEG"/.../"SÁB" a partir do dia da semana real da data (getDay(),
 * 0=domingo) — não depende da ordem em que `days` foi passado ao
 * componente, então funciona tanto para uma semana Dom-Sáb (Figma) quanto
 * Seg-Dom (convenção do resto do app, ver WEEKDAY_SHORT_LABELS em
 * pages/Agenda/agendaShared.ts). */
export function weekdayOverline(date: Date): string {
  return WEEKDAY_OVERLINE[date.getDay()]!
}

/** "YYYY-MM-DD" -> Date local à meia-noite (evita o shift de fuso horário
 * de `new Date("YYYY-MM-DD")`, que o motor interpreta como UTC). */
export function parseISODate(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

const MIN_EVENT_HEIGHT_PX = 24

export interface AgendaMobileEventLayout {
  top: number
  height: number
}

/**
 * Posição (top/height, em px) de um evento na timeline, proporcional ao seu
 * horário dentro de [startHour, endHour) — mesma ideia de "HH:MM -> minutos
 * -> proporção" já usada por TimePicker.parseTime/generateSlots, aqui
 * aplicada a um eixo vertical contínuo em vez de slots discretos.
 *
 * Eventos parcialmente fora da janela são recortados (clamp) nas bordas;
 * eventos totalmente fora retornam null (o chamador simplesmente não
 * renderiza). Altura mínima de MIN_EVENT_HEIGHT_PX para eventos muito
 * curtos permanecerem legíveis/tocáveis.
 */
export function computeEventLayout(
  event: Pick<AgendaMobileEvent, 'start' | 'end'>,
  startHour: number,
  endHour: number,
  hourHeightPx: number,
): AgendaMobileEventLayout | null {
  const gridStartMinutes = startHour * 60
  const gridEndMinutes = endHour * 60
  const startMinutes = parseHM(event.start)
  const endMinutes = parseHM(event.end)
  if (startMinutes === null || endMinutes === null) return null
  if (endMinutes <= startMinutes) return null
  if (endMinutes <= gridStartMinutes || startMinutes >= gridEndMinutes) return null

  const clampedStart = Math.max(startMinutes, gridStartMinutes)
  const clampedEnd = Math.min(endMinutes, gridEndMinutes)
  const top = ((clampedStart - gridStartMinutes) / 60) * hourHeightPx
  const height = Math.max(((clampedEnd - clampedStart) / 60) * hourHeightPx, MIN_EVENT_HEIGHT_PX)
  return { top, height }
}

/**
 * Tom de status de uma reserva. Mesmo conjunto de AgendaDesktop
 * (AgendaDesktopEventStatus) — os dois frames desenham a mesma paleta de
 * status, mas cada componente mantém a sua cópia pelo mesmo motivo dos
 * helpers de tempo duplicados: vêm de frames independentes e não devem
 * depender de internals um do outro. As cores em si vivem no CSS
 * (`[data-tone]`), não aqui, porque o tom do TEXTO muda entre claro e
 * escuro (`--state-*-text` só tem contraste AA no claro) e uma custom
 * property inline não consegue alternar por tema.
 */
export type AgendaMobileEventStatus = 'confirmado' | 'pendente' | 'particular' | 'bloqueio' | 'livre'

export interface AgendaMobileDay {
  /** "YYYY-MM-DD" local. */
  date: string
  /** Mostra o dot de indicador — o chamador decide o que conta como
   * "tem evento" (ex.: alguma reserva confirmada naquele dia). */
  hasEvents?: boolean
}

export interface AgendaMobileCourtFilter {
  id: string
  label: string
  /** Slug de lib/sports.ts — o dot do chip usa a cor do esporte da quadra
   * (mesmo padrão de CourtCard/ClassCard/SportTag: cor derivada do esporte,
   * nunca uma cor arbitrária por quadra). Opcional: quem só tem o NOME da
   * quadra (ex.: a agenda do professor, que lê `courtName` de um booking e
   * não busca a lista de quadras) passa o chip sem dot. */
  sport?: string
}

export interface AgendaMobileEvent {
  id: string
  title: string
  subtitle?: string
  /** "HH:MM" */
  start: string
  /** "HH:MM" */
  end: string
  /** Status da reserva — decide a cor do card (fundo `--state-*-soft`,
   * texto `--state-*-text`/`--state-*`), como nos frames reais da tela. */
  status?: AgendaMobileEventStatus
  /** Slug de lib/sports.ts — cor do stripe/realce do card quando NÃO há
   * `status`. Mantido pelo frame original do pattern (63:6), que colore por
   * esporte; `status` tem precedência quando os dois vêm juntos. */
  sport?: string
}

/** Slot livre da timeline — o chip tracejado "+ Avulsa" do frame 5:217
 * (node 163:5385). `hour` é a hora cheia; o rótulo vem pronto do chamador
 * (o frame mostra também o preço, que a API de agenda não devolve — ver
 * relatório da tela). */
export interface AgendaMobileFreeSlot {
  hour: number
  label: string
}

export interface AgendaMobileAction {
  label: string
  variant?: 'primary' | 'secondary'
  onClick?: () => void
}

export interface AgendaMobileProps {
  /** Título da tela. Admin usa "Agenda"; a agenda do professor usa
   * "Minhas aulas" (frame 35:1096). */
  title?: string
  /** Opções do toggle acima do navegador de semana (frame 5:217:
   * ["Dia", "Semana"]). Vazio/ausente esconde o toggle — é o caso do
   * professor, que não tem visão de semana. */
  viewOptions?: string[]
  view?: string
  onViewChange?: (view: string) => void
  /** Controle extra do cabeçalho (a busca de AG1, que não existe em
   * nenhum frame desta tela mas é comportamento já entregue). Escape hatch
   * deliberado: mantém o componente fiel ao frame em vez de inventar um
   * campo de busca no design. */
  headerExtra?: ReactNode
  /** "26 jul – 1 ago" — já formatado pelo chamador (ex.: via
   * formatWeekLabel de pages/Agenda/agendaShared.ts). */
  rangeLabel: string
  onPrevWeek?: () => void
  onNextWeek?: () => void
  /** Dias exibidos na weekStrip, na ordem em que devem aparecer. */
  days: AgendaMobileDay[]
  /** "YYYY-MM-DD" do dia selecionado. */
  selectedDate: string
  onSelectDate?: (date: string) => void
  courts: AgendaMobileCourtFilter[]
  /** Ids das quadras ativas no filtro — multi-seleção (o dot colorido por
   * quadra sugere "quais quadras mostrar", não uma escolha única; para
   * escolha única já existe ui/Segmented). */
  selectedCourtIds: string[]
  onToggleCourt?: (courtId: string) => void
  /** Legenda de status entre os filtros e a timeline (frame 5:217, node
   * 163:5368). Ausente = sem legenda (frame do professor). */
  legend?: { status: AgendaMobileEventStatus; label: string }[]
  /** Eventos do dia selecionado, já filtrados pelo chamador (o componente
   * não filtra por selectedCourtIds/selectedDate sozinho). */
  events: AgendaMobileEvent[]
  onSelectEvent?: (eventId: string) => void
  /** Chips tracejados de horário livre. */
  freeSlots?: AgendaMobileFreeSlot[]
  onSelectFreeSlot?: (hour: number) => void
  /** Renderizado NO LUGAR da timeline quando não há nenhum evento (frame
   * 188:2111). Ausente = timeline vazia, só com as linhas de hora. */
  emptyState?: ReactNode
  /** Ação principal abaixo da timeline: "+ Nova reserva" (admin) ou
   * "+ Solicitar bloqueio" (professor). */
  action?: AgendaMobileAction
  /** Primeira hora exibida na timeline. Default 6 (Figma). */
  startHour?: number
  /** Limite superior exclusivo da timeline. Default 14 (Figma: linhas 6h-13h). */
  endHour?: number
  /** Altura de 1h na timeline, em px. Default 40 (--space-10). */
  hourHeightPx?: number
}

export function AgendaMobile({
  title = 'Agenda',
  viewOptions,
  view,
  onViewChange,
  headerExtra,
  rangeLabel,
  onPrevWeek,
  onNextWeek,
  days,
  selectedDate,
  onSelectDate,
  courts,
  selectedCourtIds,
  onToggleCourt,
  legend,
  events,
  onSelectEvent,
  freeSlots,
  onSelectFreeSlot,
  emptyState,
  action,
  startHour = 6,
  endHour = 14,
  hourHeightPx = 40,
}: AgendaMobileProps) {
  const hours = hoursInRange(startHour, endHour)
  const timelineHeight = hours.length * hourHeightPx
  const showEmptyState = Boolean(emptyState) && events.length === 0

  return (
    <div className="agenda-mobile">
      <h1 className="agenda-mobile__title">{title}</h1>

      {viewOptions && viewOptions.length > 0 ? (
        <Segmented
          ariaLabel="Alternar entre visão Dia e Semana"
          options={viewOptions}
          value={view}
          onChange={onViewChange}
        />
      ) : null}

      {headerExtra ? <div className="agenda-mobile__header-extra">{headerExtra}</div> : null}

      <div className="agenda-mobile__nav-row">
        <IconButton variant="secondary" size="sm" label="Semana anterior" onClick={onPrevWeek}>
          ‹
        </IconButton>
        <span className="agenda-mobile__range">{rangeLabel}</span>
        <IconButton variant="secondary" size="sm" label="Próxima semana" onClick={onNextWeek}>
          ›
        </IconButton>
      </div>

      <div className="agenda-mobile__week-strip" role="tablist" aria-label="Dias da semana">
        {days.map((day) => {
          const date = parseISODate(day.date)
          const isSelected = day.date === selectedDate
          return (
            <button
              type="button"
              key={day.date}
              role="tab"
              aria-selected={isSelected}
              className={`agenda-mobile__day${isSelected ? ' agenda-mobile__day--selected' : ''}`}
              onClick={() => onSelectDate?.(day.date)}
            >
              <span className="agenda-mobile__day-label">{weekdayOverline(date)}</span>
              <span className="agenda-mobile__day-number">{date.getDate()}</span>
              <span
                className={`agenda-mobile__day-dot${day.hasEvents ? ' agenda-mobile__day-dot--active' : ''}`}
                aria-hidden="true"
              />
            </button>
          )
        })}
      </div>

      {courts.length > 0 ? (
        <div className="agenda-mobile__filter-row" role="group" aria-label="Filtrar por quadra">
          {courts.map((court) => {
            const isSelected = selectedCourtIds.includes(court.id)
            const style = court.sport
              ? ({ '--agenda-mobile-chip-color': `var(${sportCssVar(court.sport)})` } as CSSProperties)
              : undefined
            return (
              <button
                type="button"
                key={court.id}
                className={`agenda-mobile__chip${isSelected ? ' agenda-mobile__chip--selected' : ''}`}
                style={style}
                aria-pressed={isSelected}
                onClick={() => onToggleCourt?.(court.id)}
              >
                {court.sport ? <span className="agenda-mobile__chip-dot" aria-hidden="true" /> : null}
                {court.label}
              </button>
            )
          })}
        </div>
      ) : null}

      {legend && legend.length > 0 ? (
        <div className="agenda-mobile__legend">
          {legend.map((item) => (
            <span className="agenda-mobile__legend-item" key={item.label}>
              <span className="agenda-mobile__legend-dot" data-tone={item.status} aria-hidden="true" />
              <span className="agenda-mobile__legend-label">{item.label}</span>
            </span>
          ))}
        </div>
      ) : null}

      {showEmptyState ? (
        <div className="agenda-mobile__empty">{emptyState}</div>
      ) : (
        <div
          className="agenda-mobile__timeline"
          style={{ '--agenda-mobile-timeline-h': `${timelineHeight}px` } as CSSProperties}
        >
          {hours.map((hour, index) => {
            const rowStyle = {
              '--agenda-mobile-row-top': `${index * hourHeightPx}px`,
              '--agenda-mobile-row-h': `${hourHeightPx}px`,
            } as CSSProperties
            return (
              <div key={hour} className="agenda-mobile__hour-row" style={rowStyle}>
                <span className="agenda-mobile__hour-label">{formatHourLabel(hour)}</span>
              </div>
            )
          })}

          {(freeSlots ?? []).map((slot) => {
            const layout = computeEventLayout(
              { start: `${String(slot.hour).padStart(2, '0')}:00`, end: `${String(slot.hour + 1).padStart(2, '0')}:00` },
              startHour,
              endHour,
              hourHeightPx,
            )
            if (!layout) return null
            const style = {
              '--agenda-mobile-event-top': `${layout.top}px`,
              '--agenda-mobile-event-h': `${layout.height}px`,
            } as CSSProperties
            return (
              <button
                type="button"
                key={`free-${slot.hour}`}
                className="agenda-mobile__free-slot"
                style={style}
                data-testid={`agenda-mobile-free-${slot.hour}`}
                onClick={() => onSelectFreeSlot?.(slot.hour)}
              >
                {slot.label}
              </button>
            )
          })}

          {events.map((event) => {
            const layout = computeEventLayout(event, startHour, endHour, hourHeightPx)
            if (!layout) return null
            const style = {
              '--agenda-mobile-event-top': `${layout.top}px`,
              '--agenda-mobile-event-h': `${layout.height}px`,
              ...(event.status || !event.sport
                ? null
                : { '--agenda-mobile-event-color': `var(${sportCssVar(event.sport)})` }),
            } as CSSProperties
            const content = (
              <>
                <span className="agenda-mobile__event-stripe" aria-hidden="true" />
                <span className="agenda-mobile__event-title">{event.title}</span>
                {event.subtitle ? (
                  <span className="agenda-mobile__event-subtitle">{event.subtitle}</span>
                ) : null}
              </>
            )
            const className = `agenda-mobile__event${event.status ? '' : ' agenda-mobile__event--sport'}`
            return onSelectEvent ? (
              <button
                type="button"
                key={event.id}
                className={className}
                data-tone={event.status}
                style={style}
                data-testid={`agenda-mobile-event-${event.id}`}
                onClick={() => onSelectEvent(event.id)}
              >
                {content}
              </button>
            ) : (
              <div
                key={event.id}
                className={className}
                data-tone={event.status}
                style={style}
                data-testid={`agenda-mobile-event-${event.id}`}
              >
                {content}
              </div>
            )
          })}
        </div>
      )}

      {action ? (
        <div className="agenda-mobile__action">
          <Button variant={action.variant ?? 'primary'} size="md" fullWidth onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
