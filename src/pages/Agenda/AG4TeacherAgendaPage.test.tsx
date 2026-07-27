import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as bookingsApi from '../../lib/api/bookings'
import type { Booking } from '../../lib/api/bookings'
import * as meApi from '../../lib/api/me'
import * as tenantContext from '../../lib/tenantContext'
import AG4TeacherAgendaPage from './AG4TeacherAgendaPage'

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'b1',
    courtId: 'c1',
    courtName: 'Quadra 2',
    type: 'class_occurrence',
    classId: 'cl1',
    className: 'Beach tennis intermediária',
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
    studentCount: 6,
    ...overrides,
  }
}

beforeEach(() => {
  vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'teacher-1', fullName: 'Usuária de Teste' })
  vi.spyOn(tenantContext, 'getSessionMemberships').mockReturnValue([{ unit_id: 'unit-1', tenant_id: 'tenant-1' }])
})

afterEach(() => {
  vi.restoreAllMocks()
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/units/unit-1/agenda/professor']}>
      <Routes>
        <Route path="/units/:unitId/agenda/professor" element={<AG4TeacherAgendaPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AG4TeacherAgendaPage', () => {
  it('defaults to the "Hoje" tab and lists bookings', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, viewOnly: false, bookings: [booking()] })

    renderPage()

    expect(screen.getByRole('tab', { name: 'Hoje' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText('Beach tennis intermediária')).toBeInTheDocument()
  })

  it('shows [CHECK-IN]/[ALUNOS] when the booking is within the check-in window', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [booking({ startAt: new Date().toISOString(), checkedIn: false })],
    })

    renderPage()

    expect(await screen.findByRole('button', { name: 'Check-in' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Alunos' })).toBeInTheDocument()
  })

  it('shows "Disponível às HH:MM" for a future booking outside the check-in window', async () => {
    const futureStart = new Date(Date.now() + 3 * 60 * 60 * 1000) // 3h from now, outside 15min window
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [booking({ startAt: futureStart.toISOString(), checkedIn: false })],
    })

    renderPage()

    const expectedLabel = futureStart.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    expect(await screen.findByText(`Disponível às ${expectedLabel}`)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check-in' })).not.toBeInTheDocument()
  })

  it('shows "✅ Check-in feito" when checkedIn=true, hiding the action buttons', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [booking({ checkedIn: true })],
    })

    renderPage()

    expect(await screen.findByText('✅ Check-in feito')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check-in' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Alunos' })).not.toBeInTheDocument()
  })

  it('shows the student name instead of the student count for a private lesson', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [
        booking({
          type: 'private',
          classId: null,
          className: null,
          studentName: 'João Pedro',
          studentCount: 0,
        }),
      ],
    })

    renderPage()

    expect(await screen.findByText('Aula particular')).toBeInTheDocument()
    expect(screen.getByText('Quadra 2 · João Pedro')).toBeInTheDocument()
    expect(screen.queryByText(/alunos$/)).not.toBeInTheDocument()
  })

  it('shows the student count for a class occurrence (not the student name)', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [booking({ studentCount: 6 })],
    })

    renderPage()

    expect(await screen.findByText('Quadra 2 · 6 alunos')).toBeInTheDocument()
  })

  it('does NOT show an arena group header for a single-arena teacher', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [booking({ unitId: 'unit-1', unitName: 'Arena Areia Dourada' })],
    })

    const { container } = renderPage()

    await screen.findByText('Beach tennis intermediária')
    // Nota: "Arena Areia Dourada" também aparece sempre no rodapé da
    // sidebar (AppShell orgLabel) — por isso checa a ausência do
    // cabeçalho de grupo pela classe, não pelo texto (que colidiria).
    expect(container.querySelector('.ag4-arena-header')).not.toBeInTheDocument()
  })

  it('groups by arena with a header when the teacher has classes in more than one unit', async () => {
    vi.spyOn(tenantContext, 'getSessionMemberships').mockReturnValue([
      { unit_id: 'unit-1', tenant_id: 'tenant-1' },
      { unit_id: 'unit-2', tenant_id: 'tenant-1' },
    ])
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockImplementation(async (unitId) => {
      if (unitId === 'unit-1') {
        return { ok: true, viewOnly: false, bookings: [booking({ id: 'b1', unitId: 'unit-1', unitName: 'Arena Areia Dourada' })] }
      }
      return {
        ok: true,
        viewOnly: false,
        bookings: [
          booking({ id: 'b2', unitId: 'unit-2', unitName: 'Arena Praia Sul', className: 'Padel Avançado' }),
        ],
      }
    })

    const { container } = renderPage()

    await waitFor(() => expect(container.querySelectorAll('.ag4-arena-header')).toHaveLength(2))
    const headers = Array.from(container.querySelectorAll('.ag4-arena-header')).map((el) => el.textContent)
    expect(headers).toEqual(['Arena Areia Dourada', 'Arena Praia Sul'])
  })

  it('shows the empty state when there are no bookings today', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, viewOnly: false, bookings: [] })

    renderPage()

    expect(await screen.findByText('Dia livre! Nenhuma aula agendada.')).toBeInTheDocument()
  })

  it('opens the "Alunos da Aula" sheet with the participant list and tier tag', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [booking({ startAt: new Date().toISOString() })],
    })
    vi.spyOn(bookingsApi, 'listBookingParticipants').mockResolvedValue({
      ok: true,
      participants: [
        {
          id: 'p1',
          bookingId: 'b1',
          studentId: 's1',
          studentName: 'Marina Costa',
          source: 'manual',
          attendanceStatus: null,
          checkedInAt: null,
          tier: 'b',
        },
      ],
    })

    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Alunos' }))

    expect(await screen.findByText('Marina Costa')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('plugs TeacherBlockRequestButton in the header once the identity resolves', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, viewOnly: false, bookings: [] })

    renderPage()

    expect(await screen.findByRole('button', { name: 'Solicitar bloqueio' })).toBeInTheDocument()
  })

  it('switches to "Semana" and groups bookings by date', async () => {
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, viewOnly: false, bookings: [booking()] })

    renderPage()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('tab', { name: 'Semana' }))

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Semana' })).toHaveAttribute('aria-selected', 'true'))
    expect(await screen.findByText('Beach tennis intermediária')).toBeInTheDocument()
  })
})
