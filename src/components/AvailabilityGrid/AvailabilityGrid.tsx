import { useState } from 'react'
import type { AvailabilitySlot, AvailabilityTimeSlot, DayOfWeek } from '../../lib/api/availability'
import { AVAILABILITY_TIME_SLOTS, patchAvailability } from '../../lib/api/availability'
import './AvailabilityGrid.css'

/**
 * AvailabilityGrid (BEAC-1878, story BEAC-1697 — "Agenda de disponibilidade
 * do professor"): grade semanal reutilizável, com dois modos independentes.
 *
 * NÃO está ligado a nenhuma tela ainda — PR3 (BEAC-1875, cadastro de
 * professor) e a aba "Horários" de PR2 ainda não existem neste código.
 * Ambos consumirão este componente no futuro; até lá ele vive standalone,
 * testado isoladamente.
 *
 * - mode="edit": toggle simples disponível/indisponível por célula — cada
 *   clique salva IMEDIATAMENTE via PATCH /teachers/{id}/availability (batch
 *   de 1 item), com atualização otimista revertida se o PATCH falhar (ex.:
 *   403 de quem não tem permissão). Usado pelo formulário de cadastro de
 *   professor (PR3, BEAC-1875, ainda não construído).
 * - mode="read": renderização somente-leitura com 3 estados visuais
 *   (disponível/ocupado com aula/indisponível) + legenda + o hint fixo do
 *   doc PR2. `busy` (ocupado com aula) não tem NENHUMA fonte de dado real
 *   ainda — depende de agendamentos do Épico 6, que não foi planejado. Este
 *   componente aceita o status via a prop `cells` (dado injetado pelo
 *   chamador) em vez de inventar uma fonte — gap conhecido e aceito, ver
 *   handover de execução desta story.
 *
 * Nota de permissão (decisão travada da plataforma, não deste componente):
 * quem decide se renderiza mode="edit" ou mode="read" para um dado usuário é
 * o CONSUMIDOR deste componente — a regra "sempre ESCONDER elementos sem
 * permissão, nunca mostrar desabilitado" implica que um usuário sem
 * permissão de edição nunca deveria nem receber mode="edit" como prop,
 * receber mode="read" diretamente. Este componente não faz nenhuma
 * verificação de permissão internamente.
 */

/** Rótulos em PT-BR por day_of_week (0=Domingo ... 6=Sábado, mesmo intervalo
 * do CHECK do backend, migrations/000030_teacher_availability). */
const DAY_LABELS: Record<DayOfWeek, string> = {
  0: 'Domingo',
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
}

const DAY_SHORT_LABELS: Record<DayOfWeek, string> = {
  0: 'Dom',
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb',
}

/** Dias exibidos por padrão: Seg-Sáb, mesmas colunas do protótipo real
 * (Artifact "Rallye — Pessoas & Turmas", scr-pr2, aba Horários) — Domingo
 * (0) existe no modelo de dados (CHECK permite 0-6) mas não é exibido por
 * padrão nesta grade. */
const DEFAULT_DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6]

export type AvailabilityCellStatus = 'available' | 'busy' | 'unavailable'

export interface AvailabilityGridReadCell {
  dayOfWeek: DayOfWeek
  timeSlot: AvailabilityTimeSlot
  status: AvailabilityCellStatus
}

interface AvailabilityGridEditProps {
  mode: 'edit'
  /** Professor cuja grade está sendo editada — usado para chamar PATCH
   * /teachers/{teacherId}/availability. */
  teacherId: string
  slots: AvailabilitySlot[]
  /** Dias exibidos (colunas), na ordem informada. Default: Seg-Sáb. */
  days?: DayOfWeek[]
  /** Chamado com o slot atualizado após um PATCH bem-sucedido — permite ao
   * consumidor futuro (PR3) sincronizar seu próprio estado. */
  onToggle?: (slot: AvailabilitySlot) => void
}

interface AvailabilityGridReadProps {
  mode: 'read'
  cells: AvailabilityGridReadCell[]
  /** Dias exibidos (colunas), na ordem informada. Default: Seg-Sáb. */
  days?: DayOfWeek[]
}

export type AvailabilityGridProps = AvailabilityGridEditProps | AvailabilityGridReadProps

function slotKey(dayOfWeek: number, timeSlot: string): string {
  return `${dayOfWeek}-${timeSlot}`
}

export function AvailabilityGrid(props: AvailabilityGridProps) {
  if (props.mode === 'edit') return <EditGrid {...props} />
  return <ReadGrid {...props} />
}

function EditGrid({ teacherId, slots, days = DEFAULT_DAYS, onToggle }: AvailabilityGridEditProps) {
  const [bySlot, setBySlot] = useState<Map<string, boolean>>(
    () => new Map(slots.map((s) => [slotKey(s.dayOfWeek, s.timeSlot), s.available])),
  )

  async function handleToggle(dayOfWeek: DayOfWeek, timeSlot: AvailabilityTimeSlot) {
    const key = slotKey(dayOfWeek, timeSlot)
    const current = bySlot.get(key) ?? false
    const next = !current

    // Atualização otimista — revertida abaixo se o PATCH falhar.
    setBySlot((prev) => new Map(prev).set(key, next))

    const result = await patchAvailability(teacherId, [{ dayOfWeek, timeSlot, available: next }])

    if (!result.ok) {
      setBySlot((prev) => new Map(prev).set(key, current))
      return
    }

    onToggle?.({ dayOfWeek, timeSlot, available: next })
  }

  return (
    <div className="availability-grid">
      <GridTable
        days={days}
        renderCell={(dayOfWeek, timeSlot) => {
          const available = bySlot.get(slotKey(dayOfWeek, timeSlot)) ?? false
          return (
            <button
              type="button"
              key={slotKey(dayOfWeek, timeSlot)}
              className="availability-cell availability-cell--edit"
              data-status={available ? 'available' : 'unavailable'}
              aria-pressed={available}
              aria-label={`${DAY_LABELS[dayOfWeek]} ${timeSlot}`}
              onClick={() => {
                void handleToggle(dayOfWeek, timeSlot)
              }}
            />
          )
        }}
      />
    </div>
  )
}

function ReadGrid({ cells, days = DEFAULT_DAYS }: AvailabilityGridReadProps) {
  const byCell = new Map(cells.map((c) => [slotKey(c.dayOfWeek, c.timeSlot), c.status]))

  return (
    <div className="availability-grid">
      <GridTable
        days={days}
        renderCell={(dayOfWeek, timeSlot) => {
          const status = byCell.get(slotKey(dayOfWeek, timeSlot)) ?? 'unavailable'
          return (
            <div
              key={slotKey(dayOfWeek, timeSlot)}
              className="availability-cell availability-cell--read"
              data-status={status}
              data-testid={`availability-cell-${dayOfWeek}-${timeSlot}`}
              aria-label={`${DAY_LABELS[dayOfWeek]} ${timeSlot}: ${readStatusLabel(status)}`}
            />
          )
        }}
      />
      <AvailabilityLegend />
      <p className="availability-grid__hint">
        Editável pelo admin e pelo próprio professor. Usada como referência ao agendar (AG6 alerta
        conflito).
      </p>
    </div>
  )
}

function readStatusLabel(status: AvailabilityCellStatus): string {
  switch (status) {
    case 'available':
      return 'Disponível'
    case 'busy':
      return 'Ocupado com aula'
    case 'unavailable':
      return 'Indisponível'
  }
}

function AvailabilityLegend() {
  return (
    <ul className="availability-legend">
      <li className="availability-legend__item">
        <span className="availability-legend__swatch" data-status="available" />
        Disponível
      </li>
      <li className="availability-legend__item">
        <span className="availability-legend__swatch" data-status="busy" />
        Ocupado com aula
      </li>
      <li className="availability-legend__item">
        <span className="availability-legend__swatch" data-status="unavailable" />
        Indisponível
      </li>
    </ul>
  )
}

interface GridTableProps {
  days: DayOfWeek[]
  renderCell: (dayOfWeek: DayOfWeek, timeSlot: AvailabilityTimeSlot) => React.ReactNode
}

/** Estrutura de tabela compartilhada por EditGrid/ReadGrid — cabeçalho com
 * os dias (colunas) e uma linha por faixa de horário (8 linhas fixas). */
function GridTable({ days, renderCell }: GridTableProps) {
  return (
    <table className="availability-grid__table">
      <thead>
        <tr>
          <th scope="col" className="availability-grid__corner" />
          {days.map((day) => (
            <th scope="col" key={day}>
              {DAY_SHORT_LABELS[day]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {AVAILABILITY_TIME_SLOTS.map((timeSlot) => (
          <tr key={timeSlot}>
            <th scope="row" className="availability-grid__row-label">
              {timeSlot}
            </th>
            {days.map((day) => (
              <td key={day}>{renderCell(day, timeSlot)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
