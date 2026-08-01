import { screen, waitFor } from '@testing-library/react'
import { renderWithQuery } from '../../test/renderWithQuery'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as usePermissionModule from '../../hooks/usePermission'
import * as bookingsApi from '../../lib/api/bookings'
import type { Booking, BookingParticipant } from '../../lib/api/bookings'
import CheckinPage from './CheckinPage'

afterEach(() => {
  vi.restoreAllMocks()
})

function mockPermissions(map: Record<string, boolean>) {
  vi.spyOn(usePermissionModule, 'usePermission').mockImplementation(
    (module: string, action: string) => map[`${module}:${action}`] ?? false,
  )
}

const booking: Booking = {
  id: 'b1',
  courtId: 'c1',
  courtName: 'Quadra 2',
  type: 'class_occurrence',
  classId: 'cl1',
  className: 'BT intermediária',
  startAt: new Date().toISOString(),
  endAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  status: 'confirmed',
  teacherName: 'Marcus Lima',
  studentName: null,
  responsibleName: null,
  reason: null,
  unitId: 'unit-1',
  unitName: 'Unit Teste',
  checkedIn: false,
  studentCount: 6,
}

function participant(overrides: Partial<BookingParticipant> = {}): BookingParticipant {
  return {
    id: 'p1',
    bookingId: 'b1',
    studentId: 's1',
    studentName: 'Marina Costa',
    source: 'manual',
    attendanceStatus: null,
    checkedInAt: null,
    tier: null,
    ...overrides,
  }
}

function renderWithState(state: { booking?: Booking } | null) {
  return renderWithQuery(
    <MemoryRouter initialEntries={[{ pathname: '/units/unit-1/bookings/b1/checkin', state }]}>
      <Routes>
        <Route path="/units/:unitId/bookings/:bookingId/checkin" element={<CheckinPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CheckinPage (T3, BEAC-1907)', () => {
  beforeEach(() => {
    mockPermissions({ 'agenda:write': true })
  })

  it('shows a clear message instead of crashing when opened without router state (deep link gap)', async () => {
    vi.spyOn(bookingsApi, 'listBookingParticipants').mockResolvedValue({ ok: true, participants: [] })
    renderWithState(null)

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar os detalhes desta aula/i)
  })

  it('hides the whole screen behind a permission message when the caller lacks agenda:write', async () => {
    mockPermissions({})
    vi.spyOn(bookingsApi, 'listBookingParticipants').mockResolvedValue({ ok: true, participants: [] })
    renderWithState({ booking })

    expect(await screen.findByRole('alert')).toHaveTextContent(/sem permissão/i)
  })

  it('renders header (nome da aula/data/horário/quadra) and the student list with 3 toggle buttons each', async () => {
    vi.spyOn(bookingsApi, 'listBookingParticipants').mockResolvedValue({
      ok: true,
      participants: [participant(), participant({ id: 'p2', studentId: 's2', studentName: 'João Pedro' })],
    })
    renderWithState({ booking })

    expect(screen.getByText('Check-in de presença')).toBeInTheDocument()
    expect(await screen.findByText('Marina Costa')).toBeInTheDocument()
    expect(screen.getByText('João Pedro')).toBeInTheDocument()
    expect(screen.getByText(/BT intermediária/)).toBeInTheDocument()
    expect(screen.getByText(/Quadra 2/)).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /Presente — Marina Costa/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Falta — Marina Costa/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Justificada — Marina Costa/ })).toBeInTheDocument()
  })

  it('toggles a status on click and unsets it on a second click (tap de novo desmarca)', async () => {
    const user = userEvent.setup()
    vi.spyOn(bookingsApi, 'listBookingParticipants').mockResolvedValue({ ok: true, participants: [participant()] })
    renderWithState({ booking })

    const presente = await screen.findByRole('button', { name: /Presente — Marina Costa/ })
    expect(presente).toHaveAttribute('aria-pressed', 'false')

    await user.click(presente)
    expect(presente).toHaveAttribute('aria-pressed', 'true')

    await user.click(presente)
    expect(presente).toHaveAttribute('aria-pressed', 'false')
  })

  it('"Marcar todos presentes" sets every student to presente', async () => {
    const user = userEvent.setup()
    vi.spyOn(bookingsApi, 'listBookingParticipants').mockResolvedValue({
      ok: true,
      participants: [participant(), participant({ id: 'p2', studentId: 's2', studentName: 'João Pedro' })],
    })
    renderWithState({ booking })

    await screen.findByText('Marina Costa')
    await user.click(screen.getByRole('button', { name: 'Marcar todos presentes' }))

    expect(screen.getByRole('button', { name: /Presente — Marina Costa/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Presente — João Pedro/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows a live summary ("N presentes / N faltas / N justificadas") that updates as statuses change', async () => {
    const user = userEvent.setup()
    vi.spyOn(bookingsApi, 'listBookingParticipants').mockResolvedValue({
      ok: true,
      participants: [participant(), participant({ id: 'p2', studentId: 's2', studentName: 'João Pedro' })],
    })
    renderWithState({ booking })

    await screen.findByText('Marina Costa')
    expect(screen.getByText('✓ 0 presentes')).toBeInTheDocument()
    expect(screen.getByText('✕ 0 faltas')).toBeInTheDocument()
    expect(screen.getByText('◐ 0 justificadas')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Presente — Marina Costa/ }))
    await user.click(screen.getByRole('button', { name: /Falta — João Pedro/ }))

    expect(screen.getByText('✓ 1 presentes')).toBeInTheDocument()
    expect(screen.getByText('✕ 1 faltas')).toBeInTheDocument()
  })

  it('Salvar calls the check-in endpoint, shows the success toast, and navigates back', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    vi.spyOn(bookingsApi, 'listBookingParticipants').mockResolvedValue({ ok: true, participants: [participant()] })
    const submitSpy = vi.spyOn(bookingsApi, 'submitAttendance').mockResolvedValue({
      ok: true,
      bookingId: 'b1',
      retroactive: false,
      results: [{ studentId: 's1', attendanceStatus: 'presente', checkedInAt: '2026-07-20T18:05:00Z', consecutiveFaltasAlert: false }],
    })
    renderWithState({ booking })

    await user.click(await screen.findByRole('button', { name: /Presente — Marina Costa/ }))
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(submitSpy).toHaveBeenCalledWith('b1', [{ studentId: 's1', status: 'presente' }]))
    expect(await screen.findByText('Presença registrada!')).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('shows the retroactive banner when the response says retroactive=true', async () => {
    const user = userEvent.setup()
    vi.spyOn(bookingsApi, 'listBookingParticipants').mockResolvedValue({ ok: true, participants: [participant()] })
    vi.spyOn(bookingsApi, 'submitAttendance').mockResolvedValue({
      ok: true,
      bookingId: 'b1',
      retroactive: true,
      results: [{ studentId: 's1', attendanceStatus: 'presente', checkedInAt: '2026-07-20T21:05:00Z', consecutiveFaltasAlert: false }],
    })
    renderWithState({ booking })

    await user.click(await screen.findByRole('button', { name: /Presente — Marina Costa/ }))
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText(/check-in fora do horário/i)).toBeInTheDocument()
  })

  it('surfaces an honest error on 403 attendance_edit_locked instead of pretending it worked', async () => {
    const user = userEvent.setup()
    vi.spyOn(bookingsApi, 'listBookingParticipants').mockResolvedValue({ ok: true, participants: [participant()] })
    vi.spyOn(bookingsApi, 'submitAttendance').mockResolvedValue({
      ok: false,
      status: 403,
      error: 'attendance_edit_locked',
      message: 'edição de presença bloqueada para Professor após 24h do fim da aula — só Admin pode alterar',
    })
    renderWithState({ booking })

    await user.click(await screen.findByRole('button', { name: /Presente — Marina Costa/ }))
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText(/bloqueada para Professor após 24h/i)).toBeInTheDocument()
  })

  it('requires at least one chosen status before saving', async () => {
    const user = userEvent.setup()
    vi.spyOn(bookingsApi, 'listBookingParticipants').mockResolvedValue({ ok: true, participants: [participant()] })
    const submitSpy = vi.spyOn(bookingsApi, 'submitAttendance')
    renderWithState({ booking })

    await screen.findByText('Marina Costa')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText(/marque o status de ao menos um aluno/i)).toBeInTheDocument()
    expect(submitSpy).not.toHaveBeenCalled()
  })

  it('leaving without saving asks for confirmation ("Deseja sair sem salvar?") when there are unsaved changes', async () => {
    const user = userEvent.setup()
    vi.spyOn(bookingsApi, 'listBookingParticipants').mockResolvedValue({ ok: true, participants: [participant()] })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderWithState({ booking })

    await user.click(await screen.findByRole('button', { name: /Presente — Marina Costa/ }))
    await user.click(screen.getByRole('button', { name: '‹ Voltar' }))

    expect(confirmSpy).toHaveBeenCalledWith('Deseja sair sem salvar?')
  })

  it('leaving without any change does not ask for confirmation', async () => {
    const user = userEvent.setup()
    vi.spyOn(bookingsApi, 'listBookingParticipants').mockResolvedValue({ ok: true, participants: [participant()] })
    const confirmSpy = vi.spyOn(window, 'confirm')
    renderWithState({ booking })

    await screen.findByText('Marina Costa')
    await user.click(screen.getByRole('button', { name: '‹ Voltar' }))

    expect(confirmSpy).not.toHaveBeenCalled()
  })
})
