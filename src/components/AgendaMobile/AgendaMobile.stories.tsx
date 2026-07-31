import { useMemo, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { AgendaMobile } from './AgendaMobile'
import type { AgendaMobileCourtFilter, AgendaMobileDay, AgendaMobileEvent } from './AgendaMobile'

const COURTS: AgendaMobileCourtFilter[] = [
  { id: 'court-1', label: 'Quadra 1', sport: 'beach_tennis' },
  { id: 'court-2', label: 'Quadra 2', sport: 'padel' },
  { id: 'court-3', label: 'Quadra 3', sport: 'futevolei' },
]

const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MONTH_LONG = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

function formatIsoLocal(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Domingo (00:00 local) da semana que contém `date` — a weekStrip do Figma
 * começa em DOM, diferente da convenção Seg-início do resto do app (ver
 * comentário de weekdayOverline em AgendaMobile.tsx). Só para esta story. */
function startOfWeekSunday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() - d.getDay())
  return d
}

function formatRangeLabel(sunday: Date): string {
  const saturday = new Date(sunday)
  saturday.setDate(saturday.getDate() + 6)
  if (sunday.getMonth() === saturday.getMonth()) {
    return `${sunday.getDate()} – ${saturday.getDate()} de ${MONTH_LONG[sunday.getMonth()]}`
  }
  return `${sunday.getDate()} ${MONTH_SHORT[sunday.getMonth()]} – ${saturday.getDate()} ${MONTH_SHORT[saturday.getMonth()]}`
}

/** Eventos de exemplo por data ISO — só as datas presentes aqui "têm
 * evento" (dot ativo na weekStrip) e mostram algo na timeline quando
 * selecionadas. */
const EVENTS_BY_DATE: Record<string, AgendaMobileEvent[]> = {
  '2026-07-28': [
    { id: 'ev-1', title: 'BT Iniciante', subtitle: 'Prof. Marcus', start: '07:00', end: '08:00', sport: 'beach_tennis' },
    { id: 'ev-2', title: 'Padel Avançado', subtitle: 'Prof. Duda', start: '09:30', end: '11:00', sport: 'padel' },
  ],
  '2026-07-30': [
    { id: 'ev-3', title: 'Futevôlei Livre', subtitle: 'Sem professor', start: '12:00', end: '13:30', sport: 'futevolei' },
  ],
  '2026-07-31': [
    { id: 'ev-4', title: 'BT Intermediário', subtitle: 'Prof. Marcus', start: '06:30', end: '07:30', sport: 'beach_tennis' },
  ],
}

const ANCHOR_DATE = new Date(2026, 6, 28)

function useAgendaMobileDemoState(initialSelectedDate: Date = ANCHOR_DATE) {
  const [weekAnchor, setWeekAnchor] = useState(startOfWeekSunday(initialSelectedDate))
  const [selectedDate, setSelectedDate] = useState(formatIsoLocal(initialSelectedDate))
  const [selectedCourtIds, setSelectedCourtIds] = useState<string[]>(['court-1'])

  const days: AgendaMobileDay[] = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = new Date(weekAnchor)
        date.setDate(date.getDate() + i)
        const iso = formatIsoLocal(date)
        return { date: iso, hasEvents: Boolean(EVENTS_BY_DATE[iso]) }
      }),
    [weekAnchor],
  )

  const rangeLabel = formatRangeLabel(weekAnchor)
  const events = EVENTS_BY_DATE[selectedDate] ?? []

  function shiftWeek(deltaDays: number) {
    const next = new Date(weekAnchor)
    next.setDate(next.getDate() + deltaDays)
    setWeekAnchor(next)
    // Move a seleção junto — evitar selectedDate apontando pra uma semana
    // que não está mais visível na weekStrip.
    const nextSelected = new Date(selectedDate + 'T00:00:00')
    nextSelected.setDate(nextSelected.getDate() + deltaDays)
    setSelectedDate(formatIsoLocal(nextSelected))
  }

  function toggleCourt(courtId: string) {
    setSelectedCourtIds((prev) =>
      prev.includes(courtId) ? prev.filter((id) => id !== courtId) : [...prev, courtId],
    )
  }

  return {
    rangeLabel,
    days,
    selectedDate,
    setSelectedDate,
    selectedCourtIds,
    toggleCourt,
    events,
    onPrevWeek: () => shiftWeek(-7),
    onNextWeek: () => shiftWeek(7),
  }
}

const meta = {
  title: 'ui/AgendaMobile',
  component: AgendaMobile,
  tags: ['autodocs'],
  argTypes: {
    rangeLabel: { control: 'text' },
    startHour: { control: 'number' },
    endHour: { control: 'number' },
    hourHeightPx: { control: 'number' },
  },
  args: {
    rangeLabel: '26 jul – 1 ago',
    days: [],
    selectedDate: '2026-07-28',
    courts: COURTS,
    selectedCourtIds: ['court-1'],
    events: [],
    startHour: 6,
    endHour: 14,
    hourHeightPx: 40,
  },
} satisfies Meta<typeof AgendaMobile>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Estado real, não só args estáticos: navegar de semana (‹/›) recalcula
 * dias/rangeLabel, clicar num dia da weekStrip troca a timeline exibida, e
 * clicar num chip de quadra alterna sua seleção (multi-select) — tudo via
 * useState local, então cada controle no canvas do Storybook realmente
 * re-renderiza o componente (mesmo padrão de Segmented/DatePicker
 * Playground: args só semeiam o valor inicial, nunca a fonte de verdade).
 * startHour/endHour/hourHeightPx continuam vindo direto dos Controls do
 * Storybook (args), já que não têm um "dono" de interação no canvas.
 */
export const Playground: Story = {
  render: (args) => {
    const demo = useAgendaMobileDemoState()
    return (
      <div style={{ maxWidth: 360 }}>
        <AgendaMobile
          {...args}
          rangeLabel={demo.rangeLabel}
          days={demo.days}
          selectedDate={demo.selectedDate}
          onSelectDate={demo.setSelectedDate}
          courts={COURTS}
          selectedCourtIds={demo.selectedCourtIds}
          onToggleCourt={demo.toggleCourt}
          events={demo.events}
          onPrevWeek={demo.onPrevWeek}
          onNextWeek={demo.onNextWeek}
          startHour={args.startHour}
          endHour={args.endHour}
          hourHeightPx={args.hourHeightPx}
        />
      </div>
    )
  },
}

/** Composição completa, estática, espelhando o exemplo montado do Figma
 * (node 63:6) — útil para comparação visual lado a lado com o design. */
export const FigmaExample: Story = {
  render: () => (
    <div style={{ maxWidth: 360 }}>
      <AgendaMobile
        rangeLabel="26 jul – 1 ago"
        days={[
          { date: '2026-07-26', hasEvents: false },
          { date: '2026-07-27', hasEvents: false },
          { date: '2026-07-28', hasEvents: true },
          { date: '2026-07-29', hasEvents: false },
          { date: '2026-07-30', hasEvents: true },
          { date: '2026-07-31', hasEvents: true },
          { date: '2026-08-01', hasEvents: true },
        ]}
        selectedDate="2026-07-28"
        courts={COURTS}
        selectedCourtIds={['court-1']}
        events={[
          { id: 'ev-1', title: 'BT Iniciante', subtitle: 'Prof. Marcus', start: '07:00', end: '08:00', sport: 'beach_tennis' },
        ]}
      />
    </div>
  ),
}

/** Dia sem nenhum evento — a timeline permanece vazia, só com as linhas de
 * hora, sem estado vazio dedicado (o pattern não teve doc/AC pra um "empty
 * state" explícito). */
export const EmptyDay: Story = {
  render: () => {
    // 2026-07-29 has no entry in EVENTS_BY_DATE — starts on a day with no
    // events selected; clicking around still fully re-renders via the same
    // shared demo-state hook as Playground.
    const demo = useAgendaMobileDemoState(new Date(2026, 6, 29))
    return (
      <div style={{ maxWidth: 360 }}>
        <AgendaMobile
          rangeLabel={demo.rangeLabel}
          days={demo.days}
          selectedDate={demo.selectedDate}
          onSelectDate={demo.setSelectedDate}
          courts={COURTS}
          selectedCourtIds={demo.selectedCourtIds}
          onToggleCourt={demo.toggleCourt}
          events={demo.events}
          onPrevWeek={demo.onPrevWeek}
          onNextWeek={demo.onNextWeek}
        />
      </div>
    )
  },
}
