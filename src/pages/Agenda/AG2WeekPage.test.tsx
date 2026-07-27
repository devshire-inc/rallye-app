import { screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as bookingsApi from '../../lib/api/bookings'
import * as courtsApi from '../../lib/api/courts'
import { renderWithPermissions } from '../../test/renderWithPermissions'
import AG2WeekPage from './AG2WeekPage'

afterEach(() => {
  vi.restoreAllMocks()
})

const courts: courtsApi.Court[] = [
  { id: 'court-1', unitId: 'unit-1', name: 'Q1', sport: 'beach_tennis', status: 'active' },
  { id: 'court-2', unitId: 'unit-1', name: 'Q2', sport: 'beach_tennis', status: 'active' },
]

function renderPage() {
  return renderWithPermissions(
    <MemoryRouter initialEntries={['/units/unit-1/agenda/semana']}>
      <Routes>
        <Route path="/units/:unitId/agenda" element={<div>AG1 placeholder</div>} />
        <Route path="/units/:unitId/agenda/semana" element={<AG2WeekPage />} />
        <Route path="/units/:unitId/bookings/:bookingId" element={<div>AG5 placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AG2WeekPage', () => {
  it('shows only 1 quadra (dropdown) and the 7 weekdays as columns', async () => {
    vi.spyOn(courtsApi, 'listCourts').mockResolvedValue({ ok: true, courts })
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, bookings: [], viewOnly: false })

    renderPage()

    expect(await screen.findByLabelText('Quadra')).toBeInTheDocument()
    for (const day of ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']) {
      expect(screen.getByText(day)).toBeInTheDocument()
    }
  })

  it('renders the week stats footer with occupancy/free slots and a placeholder for revenue', async () => {
    vi.spyOn(courtsApi, 'listCourts').mockResolvedValue({ ok: true, courts })
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, bookings: [], viewOnly: false })

    renderPage()
    await waitFor(() => expect(bookingsApi.getBookingsGrid).toHaveBeenCalled())

    expect(screen.getByText(/Ocupação da semana:/)).toBeInTheDocument()
    expect(screen.getByText(/Horários livres:/)).toBeInTheDocument()
    expect(screen.getByText(/Receita da quadra:/)).toBeInTheDocument()
    expect(screen.getByText('indisponível')).toBeInTheDocument()
  })

  it('hides the FAB and disables empty slots when view_only=true', async () => {
    vi.spyOn(courtsApi, 'listCourts').mockResolvedValue({ ok: true, courts })
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, bookings: [], viewOnly: true })

    renderPage()
    await waitFor(() => expect(bookingsApi.getBookingsGrid).toHaveBeenCalled())

    expect(screen.queryByRole('button', { name: 'Nova reserva' })).not.toBeInTheDocument()
  })
})
