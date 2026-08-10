import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { AgendaDesktop } from './AgendaDesktop'
import type { AgendaDesktopCourt, AgendaDesktopEvent } from './AgendaDesktop'

const COURTS: AgendaDesktopCourt[] = [
  { id: 'court-1', label: 'Quadra 1', sport: 'beach_tennis' },
  { id: 'court-2', label: 'Quadra 2', sport: 'padel' },
  { id: 'court-3', label: 'Quadra 3', sport: 'futevolei' },
]

const WEEKDAY_LONG = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "Hoje · ter, 28 jul" / "qui, 30 jul" — só o dia atual (real, do relógio
 * de quem está vendo a story) ganha o prefixo "Hoje ·". */
function formatRangeLabel(date: Date, today: Date): string {
  const isToday = date.toDateString() === today.toDateString()
  const piece = `${WEEKDAY_LONG[date.getDay()]}, ${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`
  return isToday ? `Hoje · ${piece}` : piece
}

/** Eventos de exemplo por data ISO ("YYYY-MM-DD") — espelha o exemplo
 * assembled do Figma (node 65:6) na data ancora, com um segundo dia
 * diferente pra provar que a navegação de dia realmente troca o conteúdo. */
const EVENTS_BY_DATE: Record<string, AgendaDesktopEvent[]> = {
  '2026-07-28': [
    { id: 'ev-1', courtId: 'court-1', title: 'BT Iniciante', subtitle: 'Prof. Marcus', start: '07:00', end: '08:00', status: 'confirmado' },
    { id: 'ev-2', courtId: 'court-2', title: 'Particular · Marina', subtitle: 'Prof. Ana', start: '09:00', end: '10:00', status: 'particular' },
    { id: 'ev-3', courtId: 'court-3', title: 'Locação · João', subtitle: 'Aluguel', start: '08:00', end: '09:00', status: 'confirmado' },
    { id: 'ev-4', courtId: 'court-1', title: 'BT Intermediária', subtitle: 'Prof. Marcus', start: '14:00', end: '15:00', status: 'confirmado' },
    { id: 'ev-5', courtId: 'court-2', title: 'Bloqueio', start: '18:00', end: '19:00', status: 'bloqueio' },
  ],
  '2026-07-29': [
    { id: 'ev-6', courtId: 'court-1', title: 'Padel Avançado', subtitle: 'Prof. Duda', start: '10:00', end: '11:30', status: 'confirmado' },
  ],
}

function useAgendaDesktopDemoState() {
  const today = new Date(2026, 6, 28)
  const [date, setDate] = useState(today)

  function shiftDay(deltaDays: number) {
    const next = new Date(date)
    next.setDate(next.getDate() + deltaDays)
    setDate(next)
  }

  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

  return {
    rangeLabel: formatRangeLabel(date, today),
    events: EVENTS_BY_DATE[iso] ?? [],
    onPrevDay: () => shiftDay(-1),
    onNextDay: () => shiftDay(1),
  }
}

const meta = {
  title: 'ui/AgendaDesktop',
  component: AgendaDesktop,
  tags: ['autodocs'],
  argTypes: {
    rangeLabel: { control: 'text' },
    startHour: { control: 'number' },
    endHour: { control: 'number' },
    hourHeightPx: { control: 'number' },
  },
  args: {
    rangeLabel: 'Hoje · ter, 28 jul',
    courts: COURTS,
    events: [],
    startHour: 6,
    endHour: 19,
    hourHeightPx: 44,
  },
} satisfies Meta<typeof AgendaDesktop>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Estado real, não só args estáticos: navegar de dia (‹/›) recalcula
 * rangeLabel e troca os eventos exibidos (2026-07-28 tem 5 eventos,
 * 2026-07-29 tem 1, qualquer outro dia fica vazio), e "+ Nova reserva"
 * dispara um alert visível — assim o Storybook prova a interação real, não
 * só decorativa (mesmo padrão de Playground em AgendaMobile.stories.tsx:
 * args só semeiam o valor inicial via meta.args.startHour/endHour/
 * hourHeightPx nos Controls, nunca rangeLabel/events, cuja fonte de
 * verdade é o useState local).
 */
export const Playground: Story = {
  render: (args) => {
    const demo = useAgendaDesktopDemoState()
    return (
      <AgendaDesktop
        {...args}
        rangeLabel={demo.rangeLabel}
        courts={COURTS}
        events={demo.events}
        onPrevDay={demo.onPrevDay}
        onNextDay={demo.onNextDay}
        onNewBooking={() => window.alert('Nova reserva')}
        startHour={args.startHour}
        endHour={args.endHour}
        hourHeightPx={args.hourHeightPx}
      />
    )
  },
}

/** Composição completa, estática, espelhando o exemplo montado do Figma
 * (node 65:6) — útil para comparação visual lado a lado com o design. */
export const FigmaExample: Story = {
  render: () => (
    <AgendaDesktop
      rangeLabel="Hoje · ter, 28 jul"
      courts={COURTS}
      events={EVENTS_BY_DATE['2026-07-28']!}
    />
  ),
}

/** Dia sem nenhum evento — a grade permanece vazia, só com as linhas de
 * hora e os headers de quadra. */
export const EmptyDay: Story = {
  render: () => (
    <AgendaDesktop rangeLabel="qua, 5 ago" courts={COURTS} events={[]} onNewBooking={() => window.alert('Nova reserva')} />
  ),
}

/** Frame "04 · Agenda — Admin — Desktop" (81:1109) como AG1DayPage o monta:
 * toggle Dia|Semana no canto, legenda real do domínio (4 itens), horários
 * livres clicáveis, uma quadra em manutenção e a linha do "agora". */
export const AdminDesktop: Story = {
  render: () => (
    <AgendaDesktop
      rangeLabel="Hoje · ter, 28 jul"
      viewOptions={['Dia', 'Semana']}
      view="Dia"
      courts={[...COURTS, { id: 'court-4', label: 'Quadra 4', sport: 'padel', blockedLabel: 'Manutenção até sexta' }]}
      legend={[
        { status: 'confirmado', label: 'Confirmado' },
        { status: 'pendente', label: 'Pendente' },
        { status: 'particular', label: 'Particular' },
        { status: 'bloqueio', label: 'Bloqueio' },
      ]}
      events={EVENTS_BY_DATE['2026-07-28']!}
      onSelectEvent={() => {}}
      onSelectSlot={() => {}}
      nowMinutes={10 * 60 + 30}
    />
  ),
}

/** Mesma tela para quem só tem leitura na arena (`view_only` da API):
 * sem "+ Nova reserva" e com as células de horário livre inertes. */
export const SomenteLeitura: Story = {
  render: () => (
    <AgendaDesktop
      rangeLabel="Hoje · ter, 28 jul"
      courts={COURTS}
      events={EVENTS_BY_DATE['2026-07-28']!}
      onSelectSlot={() => {}}
      slotsDisabled
      actionLabel={null}
    />
  ),
}
