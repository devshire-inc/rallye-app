import type { CSSProperties } from 'react'
import { IconButton } from '../ui/IconButton/IconButton'
import { Button } from '../ui/Button/Button'
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

export type AgendaDesktopEventStatus = 'confirmado' | 'particular' | 'bloqueio' | 'livre'

/** Tokens de tom por status — dot/legenda, borda/stripe, fundo e texto do
 * card de evento (node 65:14 legendRow + 66:49 event). "Livre" não aparece
 * como card de evento no exemplo estático do Figma (representa um slot
 * vazio), mas recebe um tom simétrico aos outros 3 caso o chamador precise
 * renderizar um evento "disponível" clicável. */
const STATUS_TONE: Record<AgendaDesktopEventStatus, { dot: string; border: string; bg: string; text: string }> = {
  confirmado: { dot: '--state-success', border: '--state-success', bg: '--state-success-soft', text: '--state-success-text' },
  particular: { dot: '--state-info', border: '--state-info', bg: '--state-info-soft', text: '--state-info-text' },
  bloqueio: { dot: '--state-danger', border: '--state-danger', bg: '--state-danger-soft', text: '--state-danger-text' },
  livre: { dot: '--surface-sunken', border: '--border-default', bg: '--surface-sunken', text: '--text-muted' },
}

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
  /** "Hoje · ter, 28 jul" — já formatado pelo chamador. */
  rangeLabel: string
  onPrevDay?: () => void
  onNextDay?: () => void
  courts: AgendaDesktopCourt[]
  /** Eventos do dia exibido, já filtrados pelo chamador. */
  events: AgendaDesktopEvent[]
  onNewBooking?: () => void
  /** Primeira hora exibida na grade. Default 6 (Figma). */
  startHour?: number
  /** Limite superior exclusivo da grade. Default 19 (Figma: linhas 6h-18h). */
  endHour?: number
  /** Altura de 1h na grade, em px. Default 44 (Figma). */
  hourHeightPx?: number
}

export function AgendaDesktop({
  rangeLabel,
  onPrevDay,
  onNextDay,
  courts,
  events,
  onNewBooking,
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

  return (
    <div className="agenda-desktop">
      <div className="agenda-desktop__header-row">
        <h1 className="agenda-desktop__title">Agenda</h1>
        <div className="agenda-desktop__date-nav">
          <IconButton variant="secondary" size="sm" label="Dia anterior" onClick={onPrevDay}>
            ‹
          </IconButton>
          <span className="agenda-desktop__range">{rangeLabel}</span>
          <IconButton variant="secondary" size="sm" label="Próximo dia" onClick={onNextDay}>
            ›
          </IconButton>
        </div>
      </div>

      <div className="agenda-desktop__legend-row">
        {LEGEND_ITEMS.map((item) => {
          const tone = STATUS_TONE[item.status]
          const dotStyle = { '--agenda-desktop-legend-color': `var(${tone.dot})` } as CSSProperties
          return (
            <span className="agenda-desktop__legend-item" key={item.status}>
              <span className="agenda-desktop__legend-dot" style={dotStyle} aria-hidden="true" />
              <span className="agenda-desktop__legend-label">{item.label}</span>
            </span>
          )
        })}
        <span className="agenda-desktop__legend-spacer" aria-hidden="true" />
        <Button variant="primary" size="md" onClick={onNewBooking}>
          + Nova reserva
        </Button>
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
                <span className="agenda-desktop__court-sport">{sportLabel(court.sport)}</span>
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
            return (
              <div className="agenda-desktop__column" style={columnStyle} key={court.id}>
                {courtEvents.map((event) => {
                  const layout = computeEventLayout(event, startHour, endHour, hourHeightPx)
                  if (!layout) return null
                  const tone = STATUS_TONE[event.status]
                  const eventStyle = {
                    '--agenda-desktop-event-top': `${layout.top}px`,
                    '--agenda-desktop-event-h': `${layout.height}px`,
                    '--agenda-desktop-event-border': `var(${tone.border})`,
                    '--agenda-desktop-event-bg': `var(${tone.bg})`,
                    '--agenda-desktop-event-text': `var(${tone.text})`,
                  } as CSSProperties
                  return (
                    <div
                      key={event.id}
                      className="agenda-desktop__event"
                      style={eventStyle}
                      data-testid={`agenda-desktop-event-${event.id}`}
                    >
                      <span className="agenda-desktop__event-stripe" aria-hidden="true" />
                      <span className="agenda-desktop__event-title">{event.title}</span>
                      {event.subtitle ? (
                        <span className="agenda-desktop__event-subtitle">{event.subtitle}</span>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
