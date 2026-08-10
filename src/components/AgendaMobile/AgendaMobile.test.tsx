import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  AgendaMobile,
  computeEventLayout,
  hoursInRange,
  parseHM,
  weekdayOverline,
  type AgendaMobileCourtFilter,
  type AgendaMobileDay,
  type AgendaMobileEvent,
} from './AgendaMobile'

describe('parseHM', () => {
  it('parses HH:MM into minutes since midnight', () => {
    expect(parseHM('07:30')).toBe(450)
    expect(parseHM('00:00')).toBe(0)
    expect(parseHM('23:59')).toBe(1439)
  })

  it('returns null for an invalid format', () => {
    expect(parseHM('7:30')).toBeNull()
    expect(parseHM('25:00')).toBeNull()
    expect(parseHM('not-a-time')).toBeNull()
  })
})

describe('hoursInRange', () => {
  it('is exclusive of the upper bound', () => {
    expect(hoursInRange(6, 9)).toEqual([6, 7, 8])
  })

  it('returns an empty array when end <= start', () => {
    expect(hoursInRange(9, 9)).toEqual([])
    expect(hoursInRange(9, 6)).toEqual([])
  })
})

describe('weekdayOverline', () => {
  it('derives DOM/SEG/.../SÁB from the actual weekday, regardless of array order', () => {
    expect(weekdayOverline(new Date(2026, 6, 26))).toBe('DOM')
    expect(weekdayOverline(new Date(2026, 6, 28))).toBe('TER')
    expect(weekdayOverline(new Date(2026, 7, 1))).toBe('SÁB')
  })
})

describe('computeEventLayout', () => {
  it('positions an event proportionally to its time within the grid', () => {
    // 07:00-08:00 inside a 6h-14h grid at 40px/hour -> starts 1h after 6h.
    const layout = computeEventLayout({ start: '07:00', end: '08:00' }, 6, 14, 40)
    expect(layout).toEqual({ top: 40, height: 40 })
  })

  it('clamps an event that starts before the grid window', () => {
    const layout = computeEventLayout({ start: '05:00', end: '07:00' }, 6, 14, 40)
    expect(layout).toEqual({ top: 0, height: 40 })
  })

  it('clamps an event that ends after the grid window', () => {
    const layout = computeEventLayout({ start: '13:00', end: '15:00' }, 6, 14, 40)
    // clamped end is 14h -> 1h visible from 13h -> top=(13-6)*40=280, height=40
    expect(layout).toEqual({ top: 280, height: 40 })
  })

  it('returns null for an event fully outside the grid window', () => {
    expect(computeEventLayout({ start: '01:00', end: '02:00' }, 6, 14, 40)).toBeNull()
    expect(computeEventLayout({ start: '20:00', end: '21:00' }, 6, 14, 40)).toBeNull()
  })

  it('returns null for an invalid or inverted time range', () => {
    expect(computeEventLayout({ start: 'bad', end: '08:00' }, 6, 14, 40)).toBeNull()
    expect(computeEventLayout({ start: '08:00', end: '07:00' }, 6, 14, 40)).toBeNull()
  })

  it('enforces a minimum height for very short events', () => {
    const layout = computeEventLayout({ start: '07:00', end: '07:05' }, 6, 14, 40)
    expect(layout?.height).toBe(24)
  })
})

const DAYS: AgendaMobileDay[] = [
  { date: '2026-07-26', hasEvents: false },
  { date: '2026-07-27', hasEvents: false },
  { date: '2026-07-28', hasEvents: true },
  { date: '2026-07-29', hasEvents: false },
]

const COURTS: AgendaMobileCourtFilter[] = [
  { id: 'court-1', label: 'Quadra 1', sport: 'beach_tennis' },
  { id: 'court-2', label: 'Quadra 2', sport: 'padel' },
]

const EVENTS: AgendaMobileEvent[] = [
  { id: 'ev-1', title: 'BT Iniciante', subtitle: 'Prof. Marcus', start: '07:00', end: '08:00', sport: 'beach_tennis' },
]

function renderAgenda(overrides: Partial<React.ComponentProps<typeof AgendaMobile>> = {}) {
  return render(
    <AgendaMobile
      rangeLabel="26 jul – 1 ago"
      days={DAYS}
      selectedDate="2026-07-28"
      courts={COURTS}
      selectedCourtIds={['court-1']}
      events={EVENTS}
      {...overrides}
    />,
  )
}

describe('AgendaMobile — week navigation', () => {
  it('renders the range label and fires onPrevWeek/onNextWeek', async () => {
    const onPrevWeek = vi.fn()
    const onNextWeek = vi.fn()
    const user = userEvent.setup()
    renderAgenda({ onPrevWeek, onNextWeek })

    expect(screen.getByText('26 jul – 1 ago')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Semana anterior' }))
    await user.click(screen.getByRole('button', { name: 'Próxima semana' }))

    expect(onPrevWeek).toHaveBeenCalledTimes(1)
    expect(onNextWeek).toHaveBeenCalledTimes(1)
  })
})

describe('AgendaMobile — week strip', () => {
  it('marks the day matching selectedDate as selected', () => {
    renderAgenda()
    const tabs = screen.getAllByRole('tab')
    const selected = tabs.filter((tab) => tab.getAttribute('aria-selected') === 'true')
    expect(selected).toHaveLength(1)
    expect(selected[0]).toHaveTextContent('28')
  })

  it('calls onSelectDate with the clicked day', async () => {
    const onSelectDate = vi.fn()
    const user = userEvent.setup()
    renderAgenda({ onSelectDate })

    const tabs = screen.getAllByRole('tab')
    await user.click(tabs[1]!)

    expect(onSelectDate).toHaveBeenCalledWith('2026-07-27')
  })
})

describe('AgendaMobile — court filter chips', () => {
  it('reflects selectedCourtIds via aria-pressed', () => {
    renderAgenda()
    expect(screen.getByRole('button', { name: 'Quadra 1' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Quadra 2' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onToggleCourt with the clicked court id', async () => {
    const onToggleCourt = vi.fn()
    const user = userEvent.setup()
    renderAgenda({ onToggleCourt })

    await user.click(screen.getByRole('button', { name: 'Quadra 2' }))

    expect(onToggleCourt).toHaveBeenCalledWith('court-2')
  })
})

describe('AgendaMobile — timeline', () => {
  it('renders one hour row per hour in [startHour, endHour)', () => {
    renderAgenda({ startHour: 6, endHour: 10 })
    ;['6h', '7h', '8h', '9h'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument()
    })
    expect(screen.queryByText('10h')).not.toBeInTheDocument()
  })

  it('renders an event with its title and subtitle', () => {
    renderAgenda()
    expect(screen.getByTestId('agenda-mobile-event-ev-1')).toBeInTheDocument()
    expect(screen.getByText('BT Iniciante')).toBeInTheDocument()
    expect(screen.getByText('Prof. Marcus')).toBeInTheDocument()
  })

  it('omits an event that falls entirely outside the timeline window', () => {
    renderAgenda({
      events: [{ id: 'ev-2', title: 'Fora da janela', start: '22:00', end: '23:00', sport: 'padel' }],
    })
    expect(screen.queryByTestId('agenda-mobile-event-ev-2')).not.toBeInTheDocument()
  })
})

/* Props do reskin 2026-08 (frames 5:217 / 188:2111 / 35:1096) — todas
 * opcionais, então cada teste prova também que a ausência da prop mantém o
 * comportamento anterior do pattern. */
describe('AgendaMobile — cabeçalho da tela', () => {
  it('usa "Agenda" por padrão e aceita outro título', () => {
    const { rerender } = renderAgenda()
    expect(screen.getByRole('heading', { name: 'Agenda' })).toBeInTheDocument()

    rerender(
      <AgendaMobile
        title="Minhas aulas"
        rangeLabel="26 jul – 1 ago"
        days={DAYS}
        selectedDate="2026-07-28"
        courts={COURTS}
        selectedCourtIds={['court-1']}
        events={EVENTS}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Minhas aulas' })).toBeInTheDocument()
  })

  it('só mostra o toggle Dia|Semana quando recebe viewOptions', async () => {
    const onViewChange = vi.fn()
    const user = userEvent.setup()
    renderAgenda()
    expect(screen.queryByRole('button', { name: 'Semana' })).not.toBeInTheDocument()

    renderAgenda({ viewOptions: ['Dia', 'Semana'], view: 'Dia', onViewChange })
    await user.click(screen.getByRole('button', { name: 'Semana' }))

    expect(onViewChange).toHaveBeenCalledWith('Semana')
  })

  it('renderiza o headerExtra recebido', () => {
    renderAgenda({ headerExtra: <input aria-label="Buscar" /> })
    expect(screen.getByLabelText('Buscar')).toBeInTheDocument()
  })
})

describe('AgendaMobile — legenda, ação e estado vazio', () => {
  it('só mostra a legenda quando recebe `legend`', () => {
    renderAgenda()
    expect(screen.queryByText('Confirmado')).not.toBeInTheDocument()

    renderAgenda({ legend: [{ status: 'confirmado', label: 'Confirmado' }] })
    expect(screen.getByText('Confirmado')).toBeInTheDocument()
  })

  it('dispara a ação principal', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    renderAgenda({ action: { label: '+ Solicitar bloqueio', variant: 'secondary', onClick } })

    await user.click(screen.getByRole('button', { name: '+ Solicitar bloqueio' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('troca a timeline pelo estado vazio quando não há evento nenhum', () => {
    renderAgenda({ events: [], emptyState: <p>Sem aulas hoje</p> })
    expect(screen.getByText('Sem aulas hoje')).toBeInTheDocument()
    expect(screen.queryByText('6h')).not.toBeInTheDocument()
  })

  it('mantém a timeline quando há evento, mesmo com emptyState definido', () => {
    renderAgenda({ emptyState: <p>Sem aulas hoje</p> })
    expect(screen.queryByText('Sem aulas hoje')).not.toBeInTheDocument()
    expect(screen.getByTestId('agenda-mobile-event-ev-1')).toBeInTheDocument()
  })
})

describe('AgendaMobile — eventos e slots livres', () => {
  it('colore o evento pelo status quando ele existe, e por esporte quando não', () => {
    renderAgenda({
      events: [
        { id: 'com-status', title: 'Bloqueado', start: '07:00', end: '08:00', status: 'bloqueio' },
        { id: 'sem-status', title: 'Aula', start: '09:00', end: '10:00', sport: 'padel' },
      ],
    })

    expect(screen.getByTestId('agenda-mobile-event-com-status')).toHaveAttribute('data-tone', 'bloqueio')
    const sportEvent = screen.getByTestId('agenda-mobile-event-sem-status')
    expect(sportEvent).not.toHaveAttribute('data-tone')
    expect(sportEvent.className).toContain('agenda-mobile__event--sport')
  })

  it('só torna o evento clicável quando recebe onSelectEvent', async () => {
    const onSelectEvent = vi.fn()
    const user = userEvent.setup()
    renderAgenda()
    expect(screen.getByTestId('agenda-mobile-event-ev-1').tagName).toBe('DIV')

    renderAgenda({ onSelectEvent })
    await user.click(screen.getAllByTestId('agenda-mobile-event-ev-1')[1]!)

    expect(onSelectEvent).toHaveBeenCalledWith('ev-1')
  })

  it('renderiza os chips de horário livre e dispara onSelectFreeSlot', async () => {
    const onSelectFreeSlot = vi.fn()
    const user = userEvent.setup()
    renderAgenda({ freeSlots: [{ hour: 10, label: '+ Avulsa' }], onSelectFreeSlot })

    await user.click(screen.getByRole('button', { name: '+ Avulsa' }))

    expect(onSelectFreeSlot).toHaveBeenCalledWith(10)
  })

  it('descarta um chip de horário livre fora da janela da timeline', () => {
    renderAgenda({ freeSlots: [{ hour: 22, label: '+ Avulsa' }], startHour: 6, endHour: 14 })
    expect(screen.queryByText('+ Avulsa')).not.toBeInTheDocument()
  })
})

describe('AgendaMobile — filtro de quadra opcional', () => {
  it('omite a linha de filtro quando não há quadra nenhuma', () => {
    renderAgenda({ courts: [], selectedCourtIds: [] })
    expect(screen.queryByRole('group', { name: 'Filtrar por quadra' })).not.toBeInTheDocument()
  })

  it('aceita chip sem esporte (sem dot colorido)', () => {
    const { container } = renderAgenda({
      courts: [{ id: 'q1', label: 'Quadra 1' }],
      selectedCourtIds: [],
    })
    expect(screen.getByRole('button', { name: 'Quadra 1' })).toBeInTheDocument()
    expect(container.querySelector('.agenda-mobile__chip-dot')).toBeNull()
  })
})
