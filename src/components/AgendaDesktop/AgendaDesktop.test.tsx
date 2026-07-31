import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  AgendaDesktop,
  computeEventLayout,
  hoursInRange,
  parseHM,
  type AgendaDesktopCourt,
  type AgendaDesktopEvent,
} from './AgendaDesktop'

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

describe('computeEventLayout', () => {
  it('positions an event proportionally to its time within the grid', () => {
    // 07:00-08:00 inside a 6h-19h grid at 44px/hour -> starts 1h after 6h.
    const layout = computeEventLayout({ start: '07:00', end: '08:00' }, 6, 19, 44)
    expect(layout).toEqual({ top: 44, height: 44 })
  })

  it('clamps an event that starts before the grid window', () => {
    const layout = computeEventLayout({ start: '05:00', end: '07:00' }, 6, 19, 44)
    expect(layout).toEqual({ top: 0, height: 44 })
  })

  it('clamps an event that ends after the grid window', () => {
    const layout = computeEventLayout({ start: '18:00', end: '20:00' }, 6, 19, 44)
    // clamped end is 19h -> 1h visible from 18h -> top=(18-6)*44=528, height=44
    expect(layout).toEqual({ top: 528, height: 44 })
  })

  it('returns null for an event fully outside the grid window', () => {
    expect(computeEventLayout({ start: '01:00', end: '02:00' }, 6, 19, 44)).toBeNull()
    expect(computeEventLayout({ start: '20:00', end: '21:00' }, 6, 19, 44)).toBeNull()
  })

  it('returns null for an invalid or inverted time range', () => {
    expect(computeEventLayout({ start: 'bad', end: '08:00' }, 6, 19, 44)).toBeNull()
    expect(computeEventLayout({ start: '08:00', end: '07:00' }, 6, 19, 44)).toBeNull()
  })

  it('enforces a minimum height for very short events', () => {
    const layout = computeEventLayout({ start: '07:00', end: '07:05' }, 6, 19, 44)
    expect(layout?.height).toBe(24)
  })
})

const COURTS: AgendaDesktopCourt[] = [
  { id: 'court-1', label: 'Quadra 1', sport: 'beach_tennis' },
  { id: 'court-2', label: 'Quadra 2', sport: 'padel' },
  { id: 'court-3', label: 'Quadra 3', sport: 'futevolei' },
]

const EVENTS: AgendaDesktopEvent[] = [
  { id: 'ev-1', courtId: 'court-1', title: 'BT Iniciante', subtitle: 'Prof. Marcus', start: '07:00', end: '08:00', status: 'confirmado' },
  { id: 'ev-2', courtId: 'court-2', title: 'Particular · Marina', subtitle: 'Prof. Ana', start: '09:00', end: '10:00', status: 'particular' },
]

function renderAgenda(overrides: Partial<React.ComponentProps<typeof AgendaDesktop>> = {}) {
  return render(
    <AgendaDesktop rangeLabel="Hoje · ter, 28 jul" courts={COURTS} events={EVENTS} {...overrides} />,
  )
}

describe('AgendaDesktop — header', () => {
  it('renders the title and range label', () => {
    renderAgenda()
    expect(screen.getByText('Agenda')).toBeInTheDocument()
    expect(screen.getByText('Hoje · ter, 28 jul')).toBeInTheDocument()
  })

  it('fires onPrevDay/onNextDay', async () => {
    const onPrevDay = vi.fn()
    const onNextDay = vi.fn()
    const user = userEvent.setup()
    renderAgenda({ onPrevDay, onNextDay })

    await user.click(screen.getByRole('button', { name: 'Dia anterior' }))
    await user.click(screen.getByRole('button', { name: 'Próximo dia' }))

    expect(onPrevDay).toHaveBeenCalledTimes(1)
    expect(onNextDay).toHaveBeenCalledTimes(1)
  })
})

describe('AgendaDesktop — legend', () => {
  it('renders the 4 status labels', () => {
    renderAgenda()
    expect(screen.getByText('Confirmado')).toBeInTheDocument()
    expect(screen.getByText('Particular')).toBeInTheDocument()
    expect(screen.getByText('Bloqueio')).toBeInTheDocument()
    expect(screen.getByText('Livre')).toBeInTheDocument()
  })

  it('fires onNewBooking when "+ Nova reserva" is clicked', async () => {
    const onNewBooking = vi.fn()
    const user = userEvent.setup()
    renderAgenda({ onNewBooking })

    await user.click(screen.getByRole('button', { name: '+ Nova reserva' }))

    expect(onNewBooking).toHaveBeenCalledTimes(1)
  })
})

describe('AgendaDesktop — court columns', () => {
  it('renders one column header per court, with sport subtitle', () => {
    renderAgenda()
    expect(screen.getByText('Quadra 1')).toBeInTheDocument()
    expect(screen.getByText('Beach tennis')).toBeInTheDocument()
    expect(screen.getByText('Quadra 2')).toBeInTheDocument()
    expect(screen.getByText('Padel')).toBeInTheDocument()
    expect(screen.getByText('Quadra 3')).toBeInTheDocument()
    expect(screen.getByText('Futevôlei')).toBeInTheDocument()
  })
})

describe('AgendaDesktop — hour grid', () => {
  it('renders one hour row label per hour in [startHour, endHour)', () => {
    renderAgenda({ startHour: 6, endHour: 10 })
    ;['6h', '7h', '8h', '9h'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument()
    })
    expect(screen.queryByText('10h')).not.toBeInTheDocument()
  })
})

describe('AgendaDesktop — events', () => {
  it('renders an event with its title and subtitle in the right court column', () => {
    renderAgenda()
    expect(screen.getByTestId('agenda-desktop-event-ev-1')).toBeInTheDocument()
    expect(screen.getByText('BT Iniciante')).toBeInTheDocument()
    expect(screen.getByText('Prof. Marcus')).toBeInTheDocument()
    expect(screen.getByTestId('agenda-desktop-event-ev-2')).toBeInTheDocument()
    expect(screen.getByText('Particular · Marina')).toBeInTheDocument()
  })

  it('renders an event with no subtitle', () => {
    renderAgenda({
      events: [{ id: 'ev-3', courtId: 'court-2', title: 'Bloqueio', start: '18:00', end: '19:00', status: 'bloqueio' }],
    })
    expect(screen.getByTestId('agenda-desktop-event-ev-3')).toBeInTheDocument()
    expect(screen.getByText('Bloqueio')).toBeInTheDocument()
  })

  it('omits an event that falls entirely outside the grid window', () => {
    renderAgenda({
      events: [{ id: 'ev-4', courtId: 'court-1', title: 'Fora da janela', start: '22:00', end: '23:00', status: 'confirmado' }],
    })
    expect(screen.queryByTestId('agenda-desktop-event-ev-4')).not.toBeInTheDocument()
  })

  it('omits an event whose courtId does not match any court', () => {
    renderAgenda({
      events: [{ id: 'ev-5', courtId: 'court-unknown', title: 'Quadra inexistente', start: '07:00', end: '08:00', status: 'confirmado' }],
    })
    expect(screen.queryByTestId('agenda-desktop-event-ev-5')).not.toBeInTheDocument()
  })
})
