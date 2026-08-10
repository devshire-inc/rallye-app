import type { CSSProperties, ReactNode } from 'react'
import { IconButton } from '../ui/IconButton/IconButton'
import { Button } from '../ui/Button/Button'
import { Segmented } from '../ui/Segmented/Segmented'
import { sportCssVar, sportLabel } from '../../lib/sports'
import './AgendaDesktop.css'

/**
 * AgendaDesktop (Figma "Agenda — Desktop", node 65:2/65:6) — agenda
 * multi-quadra do admin web: grade por horário (linhas) x quadra (colunas),
 * com legenda de status e ação "+ Nova reserva". Pattern novo (superfície
 * "web admin"), sem componente `ui/` equivalente — mesmo precedente de
 * AgendaMobile (vive fora de `ui/`, `ui/inventory.test.ts` não é tocado).
 *
 * Estruturalmente é o irmão desktop de AgendaMobile, mas não é um resize
 * dela: em vez de uma única timeline de um dia, é uma grade de N colunas de
 * quadra sobre linhas de hora fixas, com eventos posicionados dentro da
 * coluna da própria quadra (não sobre a grade inteira). Reimplementa suas
 * próprias funções puras de tempo (parseHM/hoursInRange/computeEventLayout)
 * em vez de importar as de AgendaMobile — os dois patterns vêm de frames
 * Figma independentes e não devem depender de internals um do outro.
 *
 * 100% controlado via props + callbacks — não busca dados nem possui estado
 * de navegação/seleção; quem usa decide o dia exibido, quais quadras
 * existem e quais eventos aparecem.
 *
 * ADAPTAÇÃO 2026-08 (reskin da Agenda, frame "04 · Agenda — Admin —
 * Desktop", 81:1109 de hb7PA0Xx3L7iHjt9AfHsGK): props novas, todas
 * opcionais e retrocompatíveis, para o componente cobrir o que AG1DayPage
 * já entregava e o frame do pattern não previa —
 * `viewOptions`/`view`/`onViewChange` (toggle Dia|Semana do canto superior
 * direito), `headerExtra` (busca), `legend` (a legenda real do domínio),
 * `actionLabel`, `onSelectEvent`, `onSelectSlot`/`slotsDisabled` (criar
 * reserva tocando num horário livre), `AgendaDesktopCourt.blockedLabel`
 * (coluna de quadra em manutenção) e `nowMinutes` (linha do "agora").
 * O status ganhou 'pendente' (a legenda travada da tela tem 4 itens:
 * Confirmado/Pendente/Particular/Bloqueio) e as cores de tom saíram do JS
 * para o CSS (`[data-tone]`), porque o tom do TEXTO precisa mudar entre
 * claro e escuro e uma custom property inline não alterna por tema.
 */

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

/** Minutos desde 00:00 para "HH:MM", ou null se o formato for inválido. */
export function parseHM(value: string): number | null {
  const match = TIME_RE.exec(value)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

/** "6h", "18h" — rótulo de linha de hora da grade. */
export function formatHourLabel(hour: number): string {
  return `${hour}h`
}

/** Horas exibidas na grade, [startHour, endHour) — limite superior
 * exclusivo (mesma convenção de AgendaMobile.hoursInRange). */
export function hoursInRange(startHour: number, endHour: number): number[] {
  if (endHour <= startHour) return []
  return Array.from({ length: endHour - startHour }, (_, i) => startHour + i)
}

const MIN_EVENT_HEIGHT_PX = 24

export interface AgendaDesktopEventLayout {
  top: number
  height: number
}

/**
 * Posição (top/height, em px) de um evento dentro da coluna da sua quadra,
 * proporcional ao seu horário dentro de [startHour, endHour) — mesma lógica
 * de AgendaMobile.computeEventLayout, duplicada localmente (ver comentário
 * de módulo). Eventos parcialmente fora da janela são recortados nas
 * bordas; totalmente fora retornam null.
 */
export function computeEventLayout(
  event: Pick<AgendaDesktopEvent, 'start' | 'end'>,
  startHour: number,
  endHour: number,
  hourHeightPx: number,
): AgendaDesktopEventLayout | null {
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

export type AgendaDesktopEventStatus =
  | 'confirmado'
  | 'pendente'
  | 'particular'
  | 'bloqueio'
  | 'livre'

const LEGEND_ITEMS: { status: AgendaDesktopEventStatus; label: string }[] = [
  { status: 'confirmado', label: 'Confirmado' },
  { status: 'particular', label: 'Particular' },
  { status: 'bloqueio', label: 'Bloqueio' },
  { status: 'livre', label: 'Livre' },
]

export interface AgendaDesktopCourt {
  id: string
  label: string
  /** Slug de lib/sports.ts — o dot do header da coluna usa a cor do
   * esporte da quadra (mesmo padrão de AgendaMobile/CourtCard/ClassCard). */
  sport: string
  /** Quando presente, a coluna inteira vira um overlay hachurado com este
   * texto (quadra em manutenção) e não aceita clique de horário livre. */
  blockedLabel?: string
}

export interface AgendaDesktopEvent {
  id: string
  courtId: string
  title: string
  subtitle?: string
  /** "HH:MM" */
  start: string
  /** "HH:MM" */
  end: string
  status: AgendaDesktopEventStatus
}

export interface AgendaDesktopProps {
  title?: string
  /** "Hoje · ter, 28 jul" — já formatado pelo chamador. */
  rangeLabel: string
  onPrevDay?: () => void
  onNextDay?: () => void
  /** Toggle Dia|Semana do canto superior direito (frame 81:1109). Vazio ou
   * ausente esconde o toggle. */
  viewOptions?: string[]
  view?: string
  onViewChange?: (view: string) => void
  /** Controle extra do cabeçalho (a busca de AG1, que não aparece em
   * nenhum frame desta tela mas é comportamento já entregue). */
  headerExtra?: ReactNode
  courts: AgendaDesktopCourt[]
  /** Eventos do dia exibido, já filtrados pelo chamador. */
  events: AgendaDesktopEvent[]
  onSelectEvent?: (eventId: string) => void
  /** Clique num horário livre da grade (courtId + hora cheia). Ausente =
   * células não interativas. */
  onSelectSlot?: (courtId: string, hour: number) => void
  /** Mantém as células de horário livre na grade, porém inertes
   * (`aria-disabled`) — é o modo somente-leitura de quem não pode criar
   * reserva na arena. */
  slotsDisabled?: boolean
  /** Legenda de status. Default: a do frame do pattern (Confirmado/
   * Particular/Bloqueio/Livre). */
  legend?: { status: AgendaDesktopEventStatus; label: string }[]
  onNewBooking?: () => void
  /** Rótulo da ação principal. `null` esconde o botão. */
  actionLabel?: string | null
  /** Minutos desde 00:00 do "agora" — desenha a linha vermelha do horário
   * atual. `null`/ausente = sem linha (dia exibido não é hoje). */
  nowMinutes?: number | null
  /** Primeira hora exibida na grade. Default 6 (Figma). */
  startHour?: number
  /** Limite superior exclusivo da grade. Default 19 (Figma: linhas 6h-18h). */
  endHour?: number
  /** Altura de 1h na grade, em px. Default 44 (Figma). */
  hourHeightPx?: number
}

export function AgendaDesktop({
  title = 'Agenda',
  rangeLabel,
  onPrevDay,
  onNextDay,
  viewOptions,
  view,
  onViewChange,
  headerExtra,
  courts,
  events,
  onSelectEvent,
  onSelectSlot,
  slotsDisabled = false,
  legend = LEGEND_ITEMS,
  onNewBooking,
  actionLabel = '+ Nova reserva',
  nowMinutes = null,
  startHour = 6,
  endHour = 19,
  hourHeightPx = 44,
}: AgendaDesktopProps) {
  const hours = hoursInRange(startHour, endHour)

  const gridStyle = {
    '--agenda-desktop-court-count': `${courts.length}`,
    '--agenda-desktop-hour-count': `${hours.length}`,
    '--agenda-desktop-hour-h': `${hourHeightPx}px`,
  } as CSSProperties

  const nowTop =
    nowMinutes !== null && nowMinutes !== undefined && nowMinutes >= startHour * 60 && nowMinutes < endHour * 60
      ? ((nowMinutes - startHour * 60) / 60) * hourHeightPx
      : null

  return (
    <div className="agenda-desktop">
      <div className="agenda-desktop__header-row">
        <h1 className="agenda-desktop__title">{title}</h1>
        <div className="agenda-desktop__date-nav">
          <IconButton variant="secondary" size="sm" label="Dia anterior" onClick={onPrevDay}>
            ‹
          </IconButton>
          <span className="agenda-desktop__range">{rangeLabel}</span>
          <IconButton variant="secondary" size="sm" label="Próximo dia" onClick={onNextDay}>
            ›
          </IconButton>
        </div>
        <span className="agenda-desktop__header-spacer" aria-hidden="true" />
        {headerExtra}
        {viewOptions && viewOptions.length > 0 ? (
          <Segmented
            ariaLabel="Alternar entre visão Dia e Semana"
            options={viewOptions}
            value={view}
            onChange={onViewChange}
          />
        ) : null}
      </div>

      <div className="agenda-desktop__legend-row">
        {legend.map((item) => (
          <span className="agenda-desktop__legend-item" key={item.label}>
            <span className="agenda-desktop__legend-dot" data-tone={item.status} aria-hidden="true" />
            <span className="agenda-desktop__legend-label">{item.label}</span>
          </span>
        ))}
        <span className="agenda-desktop__legend-spacer" aria-hidden="true" />
        {actionLabel !== null ? (
          <Button variant="primary" size="md" onClick={onNewBooking}>
            {actionLabel}
          </Button>
        ) : null}
      </div>

      <div className="agenda-desktop__grid-wrap">
        <div className="agenda-desktop__grid" style={gridStyle} role="group" aria-label="Grade de horários por quadra">
          <div className="agenda-desktop__corner" aria-hidden="true" />

          {courts.map((court) => {
            const dotStyle = { '--agenda-desktop-court-color': `var(${sportCssVar(court.sport)})` } as CSSProperties
            return (
              <div className="agenda-desktop__court-header" style={dotStyle} key={court.id}>
                <span className="agenda-desktop__court-header-top">
                  <span className="agenda-desktop__court-dot" aria-hidden="true" />
                  <span className="agenda-desktop__court-name">{court.label}</span>
                </span>
                <span className="agenda-desktop__court-sport">
                  {court.blockedLabel ? 'Manutenção' : sportLabel(court.sport)}
                </span>
              </div>
            )
          })}

          {hours.map((hour, index) => {
            const rowStyle = { '--agenda-desktop-row': `${index + 2}` } as CSSProperties
            return (
              <span className="agenda-desktop__hour-label" style={rowStyle} key={`label-${hour}`}>
                {formatHourLabel(hour)}
              </span>
            )
          })}
          {hours.map((hour, index) => {
            const lineStyle = { '--agenda-desktop-row': `${index + 2}` } as CSSProperties
            return <div className="agenda-desktop__hour-line" style={lineStyle} aria-hidden="true" key={`line-${hour}`} />
          })}

          {courts.map((court, columnIndex) => {
            const columnStyle = { '--agenda-desktop-col': `${columnIndex + 2}` } as CSSProperties
            const courtEvents = events.filter((event) => event.courtId === court.id)
            const busyHours = new Set(
              courtEvents.flatMap((event) => {
                const start = parseHM(event.start)
                const end = parseHM(event.end)
                if (start === null || end === null) return []
                return hours.filter((hour) => start < (hour + 1) * 60 && end > hour * 60)
              }),
            )
            return (
              <div className="agenda-desktop__column" style={columnStyle} key={court.id}>
                {court.blockedLabel ? (
                  <div className="agenda-desktop__blocked">
                    <span>{court.blockedLabel}</span>
                  </div>
                ) : (
                  onSelectSlot &&
                  hours
                    .filter((hour) => !busyHours.has(hour))
                    .map((hour) => {
                      const slotStyle = {
                        '--agenda-desktop-event-top': `${(hour - startHour) * hourHeightPx}px`,
                        '--agenda-desktop-event-h': `${hourHeightPx}px`,
                      } as CSSProperties
                      return (
                        <div
                          key={`slot-${hour}`}
                          className="agenda-desktop__slot"
                          style={slotStyle}
                          role="button"
                          tabIndex={slotsDisabled ? -1 : 0}
                          aria-label={`Horário livre ${court.label} ${formatHourLabel(hour)}`}
                          aria-disabled={slotsDisabled}
                          onClick={() => {
                            if (!slotsDisabled) onSelectSlot(court.id, hour)
                          }}
                        />
                      )
                    })
                )}

                {courtEvents.map((event) => {
                  const layout = computeEventLayout(event, startHour, endHour, hourHeightPx)
                  if (!layout) return null
                  const eventStyle = {
                    '--agenda-desktop-event-top': `${layout.top}px`,
                    '--agenda-desktop-event-h': `${layout.height}px`,
                  } as CSSProperties
                  const content = (
                    <>
                      <span className="agenda-desktop__event-stripe" aria-hidden="true" />
                      <span className="agenda-desktop__event-title">{event.title}</span>
                      {event.subtitle ? (
                        <span className="agenda-desktop__event-subtitle">{event.subtitle}</span>
                      ) : null}
                    </>
                  )
                  return onSelectEvent ? (
                    <button
                      type="button"
                      key={event.id}
                      className="agenda-desktop__event"
                      data-tone={event.status}
                      style={eventStyle}
                      data-testid={`agenda-desktop-event-${event.id}`}
                      onClick={() => onSelectEvent(event.id)}
                    >
                      {content}
                    </button>
                  ) : (
                    <div
                      key={event.id}
                      className="agenda-desktop__event"
                      data-tone={event.status}
                      style={eventStyle}
                      data-testid={`agenda-desktop-event-${event.id}`}
                    >
                      {content}
                    </div>
                  )
                })}
              </div>
            )
          })}

          {nowTop !== null ? (
            <div
              className="agenda-desktop__now-line"
              style={{ '--agenda-desktop-now-top': `${nowTop}px` } as CSSProperties}
              aria-hidden="true"
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
