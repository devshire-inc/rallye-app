import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as bookingsApi from '../../lib/api/bookings'
import * as courtsApi from '../../lib/api/courts'
import { renderWithPermissions } from '../../test/renderWithPermissions'
import AG1DayPage from './AG1DayPage'

afterEach(() => {
  vi.restoreAllMocks()
})

const courts: courtsApi.Court[] = [
  { id: 'court-1', unitId: 'unit-1', name: 'Q1', sport: 'beach_tennis', status: 'active' },
  { id: 'court-3', unitId: 'unit-1', name: 'Q3', sport: 'beach_tennis', status: 'maintenance' },
]

function mockCourts() {
  vi.spyOn(courtsApi, 'listCourts').mockResolvedValue({ ok: true, courts })
}

function renderPage() {
  return renderWithPermissions(
    <MemoryRouter initialEntries={['/units/unit-1/agenda']}>
      <Routes>
        <Route path="/units/:unitId/agenda" element={<AG1DayPage />} />
        <Route path="/units/:unitId/agenda/semana" element={<div>AG2 placeholder</div>} />
        <Route path="/units/:unitId/bookings/:bookingId" element={<div>AG5 placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

/* A tela renderiza AS DUAS variantes (AgendaMobile + AgendaDesktop) e o CSS
 * esconde uma — ver AG1DayPage.css. Em jsdom não há media query aplicada, então
 * as duas existem no DOM: consultas de texto compartilhado (nome de quadra,
 * legenda, "+ Nova reserva") escopam pelo bloco, ou usam getAllBy. */
function mobile(container: HTMLElement): HTMLElement {
  return container.querySelector<HTMLElement>('.ag1-page__mobile')!
}

function desktop(container: HTMLElement): HTMLElement {
  return container.querySelector<HTMLElement>('.ag1-page__desktop')!
}

describe('AG1DayPage', () => {
  it('renders one desktop column per court (including maintenance), with the blocked overlay text', async () => {
    mockCourts()
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, bookings: [], viewOnly: false })

    const { container } = renderPage()

    const grid = desktop(container)
    expect(await within(grid).findByText('Q1')).toBeInTheDocument()
    expect(within(grid).getByText('Q3')).toBeInTheDocument()
    expect(within(grid).getByText('Manutenção até sexta')).toBeInTheDocument()
  })

  it('renders the same courts as filter chips on the mobile timeline', async () => {
    mockCourts()
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, bookings: [], viewOnly: false })

    const { container } = renderPage()

    const chip = await within(mobile(container)).findByRole('button', { name: 'Q1' })
    // Nenhum chip aceso = sem filtro (todas as quadras aparecem); acender um
    // passa a filtrar por ele.
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders the 4-item status legend in both variants', async () => {
    mockCourts()
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, bookings: [], viewOnly: false })

    const { container } = renderPage()
    await waitFor(() => expect(courtsApi.listCourts).toHaveBeenCalled())

    for (const block of [mobile(container), desktop(container)]) {
      expect(within(block).getByText('Confirmado')).toBeInTheDocument()
      expect(within(block).getByText('Pendente')).toBeInTheDocument()
      expect(within(block).getByText('Particular')).toBeInTheDocument()
      expect(within(block).getByText('Bloqueio')).toBeInTheDocument()
    }
  })

  it('shows the "+ Nova reserva" action when the caller is not view-only', async () => {
    mockCourts()
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, bookings: [], viewOnly: false })

    const { container } = renderPage()

    expect(await within(mobile(container)).findByRole('button', { name: '+ Nova reserva' })).toBeInTheDocument()
    expect(within(desktop(container)).getByRole('button', { name: '+ Nova reserva' })).toBeInTheDocument()
  })

  it('hides the "+ Nova reserva" action when view_only=true (Professor)', async () => {
    mockCourts()
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, bookings: [], viewOnly: true })

    renderPage()
    await waitFor(() => expect(bookingsApi.getBookingsGrid).toHaveBeenCalled())

    expect(screen.queryByRole('button', { name: '+ Nova reserva' })).not.toBeInTheDocument()
  })

  it('marks empty desktop slots as aria-disabled when view_only=true', async () => {
    mockCourts()
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, bookings: [], viewOnly: true })

    renderPage()

    const slot = await screen.findByLabelText('Horário livre Q1 6h')
    expect(slot).toHaveAttribute('aria-disabled', 'true')
  })

  it('hides the mobile free-slot chips when view_only=true', async () => {
    mockCourts()
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, bookings: [], viewOnly: true })

    const { container } = renderPage()
    await waitFor(() => expect(bookingsApi.getBookingsGrid).toHaveBeenCalled())

    expect(within(mobile(container)).queryByText('+ Avulsa')).not.toBeInTheDocument()
  })

  it('renders a booking block with its title in both variants', async () => {
    mockCourts()
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [
        {
          id: 'b1',
          courtId: 'court-1',
          courtName: 'Q1',
          type: 'class_occurrence',
          classId: 'c1',
          className: 'BT iniciante',
          startAt: new Date().toISOString(),
          endAt: new Date(Date.now() + 3600_000).toISOString(),
          status: 'confirmed',
          teacherName: 'Marcus Lima',
          studentName: null,
          responsibleName: null,
          reason: null,
          unitId: 'unit-1',
          unitName: 'Arena Areia Dourada',
          checkedIn: false,
          studentCount: 1,
        },
      ],
    })

    const { container } = renderPage()

    expect(await screen.findByTestId('agenda-desktop-event-b1')).toHaveTextContent('BT iniciante')
    expect(within(mobile(container)).getByTestId('agenda-mobile-event-b1')).toHaveTextContent('BT iniciante')
  })

  it('shows the empty state on the mobile timeline when the day has no booking', async () => {
    mockCourts()
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, bookings: [], viewOnly: false })

    const { container } = renderPage()

    expect(await within(mobile(container)).findByText('Sem aulas hoje')).toBeInTheDocument()
    expect(
      within(mobile(container)).getByText('A agenda de hoje está livre. Reservas novas aparecem aqui.'),
    ).toBeInTheDocument()
  })
})
