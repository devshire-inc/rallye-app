import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as bookingsApi from '../../lib/api/bookings'
import * as courtsApi from '../../lib/api/courts'
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
  return render(
    <MemoryRouter initialEntries={['/units/unit-1/agenda']}>
      <Routes>
        <Route path="/units/:unitId/agenda" element={<AG1DayPage />} />
        <Route path="/units/:unitId/agenda/semana" element={<div>AG2 placeholder</div>} />
        <Route path="/units/:unitId/bookings/:bookingId" element={<div>AG5 placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AG1DayPage', () => {
  it('renders one column per court (including maintenance) and the col-blocked overlay text', async () => {
    mockCourts()
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, bookings: [], viewOnly: false })

    renderPage()

    expect(await screen.findByText('Q1')).toBeInTheDocument()
    expect(screen.getByText('Q3')).toBeInTheDocument()
    expect(screen.getByText('Manutenção até sexta')).toBeInTheDocument()
  })

  it('renders the 4-item legend plus the free-slot hint', async () => {
    mockCourts()
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, bookings: [], viewOnly: false })

    renderPage()
    await waitFor(() => expect(courtsApi.listCourts).toHaveBeenCalled())

    expect(screen.getByText('Confirmado')).toBeInTheDocument()
    expect(screen.getByText('Pendente')).toBeInTheDocument()
    expect(screen.getByText('Particular')).toBeInTheDocument()
    expect(screen.getByText('Bloqueio')).toBeInTheDocument()
    expect(screen.getByText('Livre — toque para reservar')).toBeInTheDocument()
  })

  it('shows the FAB when the caller is not view-only', async () => {
    mockCourts()
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, bookings: [], viewOnly: false })

    renderPage()

    expect(await screen.findByRole('button', { name: 'Nova reserva' })).toBeInTheDocument()
  })

  it('hides the FAB when view_only=true (Professor)', async () => {
    mockCourts()
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, bookings: [], viewOnly: true })

    renderPage()
    await waitFor(() => expect(bookingsApi.getBookingsGrid).toHaveBeenCalled())

    expect(screen.queryByRole('button', { name: 'Nova reserva' })).not.toBeInTheDocument()
  })

  it('marks empty slots as aria-disabled when view_only=true', async () => {
    mockCourts()
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, bookings: [], viewOnly: true })

    renderPage()

    const slot = await screen.findByLabelText('Horário livre Q1 06h')
    expect(slot).toHaveAttribute('aria-disabled', 'true')
  })

  it('renders a booking block with its title', async () => {
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

    renderPage()

    expect(await screen.findByText('BT iniciante')).toBeInTheDocument()
  })
})
