import { useMemo, useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '../ui/Button/Button'
import { EmptyState } from '../ui/EmptyState/EmptyState'
import { AgendaMobile } from './AgendaMobile'
import './AgendaMobile.stories.css'
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

/** Frame "02 · Agenda — Admin — Mobile" (5:217) inteiro: toggle Dia|Semana,
 * legenda de status, eventos coloridos por STATUS (não por esporte), chip
 * tracejado de horário livre e o CTA "+ Nova reserva". É a composição que
 * AG1DayPage monta com dados reais. */
export const AdminMobile: Story = {
  render: () => (
    <div className="agenda-mobile-story-frame">
      <AgendaMobile
        viewOptions={['Dia', 'Semana']}
        view="Dia"
        rangeLabel="26 jul – 1 ago"
        days={[
          { date: '2026-07-26' },
          { date: '2026-07-27' },
          { date: '2026-07-28' },
          { date: '2026-07-29' },
          { date: '2026-07-30' },
          { date: '2026-07-31' },
          { date: '2026-08-01' },
        ]}
        selectedDate="2026-07-28"
        courts={COURTS}
        selectedCourtIds={['court-1', 'court-2', 'court-3']}
        legend={[
          { status: 'confirmado', label: 'Confirmado' },
          { status: 'pendente', label: 'Pendente' },
          { status: 'particular', label: 'Particular' },
          { status: 'bloqueio', label: 'Bloqueio' },
        ]}
        events={[
          { id: 'ev-1', title: 'BT Iniciante', subtitle: 'Quadra 1 · Prof. Marcus', start: '07:00', end: '08:00', status: 'confirmado' },
          { id: 'ev-2', title: 'Marina Costa', subtitle: 'Quadra 2 · Aula particular', start: '08:00', end: '09:00', status: 'particular' },
          { id: 'ev-3', title: 'Bloqueado — Marcus Lima', subtitle: 'Quadra 1', start: '09:00', end: '10:00', status: 'bloqueio' },
        ]}
        freeSlots={[{ hour: 10, label: '+ Avulsa' }]}
        onSelectEvent={() => {}}
        onSelectFreeSlot={() => {}}
        action={{ label: '+ Nova reserva' }}
        startHour={6}
        endHour={12}
      />
    </div>
  ),
}

/** Frame "03 · Agenda — Professor — Mobile" (35:1096): mesmo pattern sem
 * filtro de quadra nem legenda, com título e ação próprios. */
export const ProfessorMobile: Story = {
  render: () => (
    <div className="agenda-mobile-story-frame">
      <AgendaMobile
        title="Minhas aulas"
        rangeLabel="26 jul – 1 ago"
        days={[
          { date: '2026-07-26' },
          { date: '2026-07-27' },
          { date: '2026-07-28' },
          { date: '2026-07-29' },
          { date: '2026-07-30' },
          { date: '2026-07-31' },
          { date: '2026-08-01' },
        ]}
        selectedDate="2026-07-28"
        courts={[]}
        selectedCourtIds={[]}
        events={[
          { id: 'ev-1', title: 'BT Iniciante', subtitle: 'Quadra 1 · 6 alunos', start: '07:00', end: '08:00', status: 'particular' },
          { id: 'ev-2', title: 'Particular · Marina Costa', subtitle: 'Quadra 2 · individual', start: '09:00', end: '10:00', status: 'particular' },
        ]}
        action={{ label: '+ Solicitar bloqueio', variant: 'secondary' }}
        startHour={6}
        endHour={12}
      />
    </div>
  ),
}

/** Frame "02b · Agenda — Vazio — Admin — Mobile" (188:2111): sem nenhum
 * evento, a timeline dá lugar ao estado vazio. O cabeçalho continua (o
 * frame só desenha o bloco vazio, mas sem a tira de dias não haveria como
 * sair de um dia sem reserva — ver o relatório da tela). */
export const DiaVazio: Story = {
  render: () => (
    <div className="agenda-mobile-story-frame">
      <AgendaMobile
        viewOptions={['Dia', 'Semana']}
        view="Dia"
        rangeLabel="26 jul – 1 ago"
        days={[{ date: '2026-07-28' }, { date: '2026-07-29' }]}
        selectedDate="2026-07-29"
        courts={COURTS}
        selectedCourtIds={['court-1']}
        events={[]}
        emptyState={
          <EmptyState
            icon="🗓"
            title="Sem aulas hoje"
            description="A agenda de hoje está livre. Reservas novas aparecem aqui."
          />
        }
        action={{ label: '+ Nova reserva' }}
      />
    </div>
  ),
}

/** Frame "03 · Agenda — Professor — Mobile" (35:1096) COM o desvio de
 * produto de AG4: a ação de check-in dentro do bloco enquanto a aula está na
 * janela (15min antes / 30min depois), e o bloco limpo fora dela. Os três
 * estados aparecem juntos aqui, que é o que o frame não mostra:
 *
 * - 07:00 na janela -> `action` (ui/Button primary/sm);
 * - 09:00 já feito  -> `badge` (ui/Badge success);
 * - 11:00 futuro    -> bloco limpo, exatamente como o frame desenha.
 *
 * `actionSlot` no lugar de `action` porque a tela real planta ali o
 * TeacherBlockRequestButton, que é dono do próprio bottom sheet.
 */
export const AgendaProfessor: Story = {
  render: () => (
    <div className="agenda-mobile-story-frame">
      <AgendaMobile
        title="Minhas aulas"
        viewOptions={['Hoje', 'Semana']}
        view="Hoje"
        rangeLabel="26 jul – 1 ago"
        days={[
          { date: '2026-07-26' },
          { date: '2026-07-27' },
          { date: '2026-07-28', hasEvents: true },
          { date: '2026-07-29' },
          { date: '2026-07-30' },
          { date: '2026-07-31' },
          { date: '2026-08-01' },
        ]}
        selectedDate="2026-07-28"
        courts={[{ id: 'court-1', label: 'Quadra 1' }, { id: 'court-2', label: 'Quadra 2' }]}
        selectedCourtIds={[]}
        events={[
          {
            id: 'ev-1',
            title: 'BT Iniciante',
            subtitle: 'Quadra 1 · 6 alunos',
            start: '07:00',
            end: '08:00',
            status: 'confirmado',
            action: { label: 'Check-in', contextLabel: 'BT Iniciante às 07:00', onClick: () => {} },
          },
          {
            id: 'ev-2',
            title: 'Particular · Marina Costa',
            subtitle: 'Quadra 2 · individual',
            start: '09:00',
            end: '10:00',
            status: 'particular',
            badge: '✅ Check-in feito',
          },
          {
            id: 'ev-3',
            title: 'BT Avançado',
            subtitle: 'Quadra 1 · 8 alunos',
            start: '11:00',
            end: '12:00',
            status: 'confirmado',
          },
        ]}
        onSelectEvent={() => {}}
        actionSlot={
          <Button variant="secondary" size="md" fullWidth>
            Solicitar bloqueio
          </Button>
        }
        startHour={6}
        endHour={13}
      />
    </div>
  ),
}

/** O caso difícil de AG4: o professor dá aula em DUAS arenas e as duas têm
 * aula às 7h. Numa timeline de um dia só há um eixo de tempo — com
 * `overlapLanes` os dois blocos dividem a faixa em colunas em vez de um
 * cobrir o outro, e a arena vai para dentro do subtítulo. Sem a prop
 * (default), o segundo bloco simplesmente somiria embaixo do primeiro. */
export const CrossArenaMesmoHorario: Story = {
  render: () => (
    <div className="agenda-mobile-story-frame">
      <AgendaMobile
        title="Minhas aulas"
        rangeLabel="26 jul – 1 ago"
        days={[{ date: '2026-07-28', hasEvents: true }, { date: '2026-07-29' }]}
        selectedDate="2026-07-28"
        courts={[
          { id: 'unit-1', label: 'Arena Beira-Mar' },
          { id: 'unit-2', label: 'Arena Praia Sul' },
        ]}
        selectedCourtIds={[]}
        filterLabel="Filtrar por arena"
        overlapLanes
        events={[
          {
            id: 'ev-1',
            title: 'BT Iniciante',
            subtitle: 'Arena Beira-Mar · Quadra 1 · 6 alunos',
            start: '07:00',
            end: '08:00',
            status: 'confirmado',
          },
          {
            id: 'ev-2',
            title: 'Padel Avançado',
            subtitle: 'Arena Praia Sul · Quadra 1 · 4 alunos',
            start: '07:00',
            end: '08:30',
            status: 'confirmado',
          },
          {
            id: 'ev-3',
            title: 'Particular · Marina Costa',
            subtitle: 'Arena Beira-Mar · Quadra 2 · individual',
            start: '09:00',
            end: '10:00',
            status: 'particular',
          },
        ]}
        onSelectEvent={() => {}}
        startHour={6}
        endHour={12}
      />
    </div>
  ),
}

/** `children` troca a timeline por um corpo qualquer, mantendo cabeçalho,
 * navegador de semana, tira de dias e chips. É como AG4 monta a aba
 * "Semana": uma semana é uma lista de aulas por dia, e não cabe num eixo de
 * tempo de um dia. */
export const CorpoAlternativoSemana: Story = {
  render: () => (
    <div className="agenda-mobile-story-frame">
      <AgendaMobile
        title="Minhas aulas"
        viewOptions={['Hoje', 'Semana']}
        view="Semana"
        rangeLabel="26 jul – 1 ago"
        days={[{ date: '2026-07-28', hasEvents: true }, { date: '2026-07-29' }]}
        selectedDate="2026-07-28"
        courts={[]}
        selectedCourtIds={[]}
        events={[]}
      >
        <p className="agenda-mobile-story-body">ter, 28 jul — BT Iniciante · 07:00</p>
        <p className="agenda-mobile-story-body">qua, 29 jul — Padel Avançado · 09:00</p>
      </AgendaMobile>
    </div>
  ),
}
