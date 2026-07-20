import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as bookingsApi from '../../lib/api/bookings'
import type { Booking, BookingParticipant } from '../../lib/api/bookings'
import * as classesApi from '../../lib/api/classes'
import type { RallyeClass } from '../../lib/api/classes'
import * as rescheduleApi from '../../lib/api/reschedule'
import type { RescheduleCredit } from '../../lib/api/reschedule'
import { RemarcarSheet } from './RemarcarSheet'

afterEach(() => {
  vi.restoreAllMocks()
})

function credit(overrides: Partial<RescheduleCredit> = {}): RescheduleCredit {
  return {
    id: 'credit-1',
    grantedAt: '2026-07-01T10:00:00Z',
    expiresAt: '2026-08-01T00:00:00Z',
    sourceBookingId: 'source-booking-1',
    ...overrides,
  }
}

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'booking-1',
    courtId: 'court-1',
    courtName: 'Quadra 1',
    type: 'class_occurrence',
    classId: 'class-1',
    className: 'Turma Beach Tennis',
    startAt: '2026-07-27T18:00:00Z',
    endAt: '2026-07-27T19:00:00Z',
    status: 'confirmed',
    teacherName: 'Marcus Lima',
    studentName: null,
    responsibleName: null,
    reason: null,
    ...overrides,
  }
}

function rallyeClass(overrides: Partial<RallyeClass> = {}): RallyeClass {
  return {
    id: 'class-1',
    unitId: 'unit-1',
    teacherId: 'teacher-1',
    sport: 'beach_tennis',
    name: 'Turma Beach Tennis',
    courtId: 'court-1',
    rrule: 'FREQ=WEEKLY;BYDAY=TU,TH',
    startTime: '18:00',
    endTime: '19:00',
    capacity: 8,
    level: null,
    status: 'active',
    ...overrides,
  }
}

function participant(id: string): BookingParticipant {
  return {
    id,
    bookingId: 'booking-1',
    studentId: id,
    studentName: null,
    source: 'manual',
    attendanceStatus: null,
    checkedInAt: null,
  }
}

/** Configura os mocks para o caminho feliz: 1 crédito disponível, 1 slot
 * com vaga, unit sem exigência de aprovação. */
function mockHappyPath(overrides: { participantCount?: number; capacity?: number } = {}) {
  vi.spyOn(rescheduleApi, 'listRescheduleCredits').mockResolvedValue({ ok: true, credits: [credit()] })
  vi.spyOn(rescheduleApi, 'getRescheduleConfig').mockResolvedValue({ ok: true, requiresApproval: false })
  vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, bookings: [booking()], viewOnly: false })
  vi.spyOn(classesApi, 'listClasses').mockResolvedValue({
    ok: true,
    classes: [rallyeClass({ capacity: overrides.capacity ?? 8 })],
  })
  const count = overrides.participantCount ?? 2
  vi.spyOn(bookingsApi, 'listBookingParticipants').mockResolvedValue({
    ok: true,
    participants: Array.from({ length: count }, (_, i) => participant(`p${i}`)),
  })
}

function renderSheet(onRescheduled = vi.fn(), onCancel = vi.fn()) {
  render(
    <RemarcarSheet unitId="unit-1" studentId="student-1" onRescheduled={onRescheduled} onCancel={onCancel} />,
  )
  return { onRescheduled, onCancel }
}

describe('RemarcarSheet — toast com contagem real de créditos', () => {
  it('shows the real credit count from the API, not the hardcoded prototype copy', async () => {
    mockHappyPath()
    renderSheet()

    expect(await screen.findByText('1 crédito de reagendamento disponível este mês')).toBeInTheDocument()
  })

  it('pluralizes the toast when there is more than 1 credit available', async () => {
    vi.spyOn(rescheduleApi, 'listRescheduleCredits').mockResolvedValue({
      ok: true,
      credits: [credit({ id: 'credit-1' }), credit({ id: 'credit-2', expiresAt: '2026-09-01T00:00:00Z' })],
    })
    vi.spyOn(rescheduleApi, 'getRescheduleConfig').mockResolvedValue({ ok: true, requiresApproval: false })
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, bookings: [], viewOnly: false })
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [] })

    renderSheet()

    expect(await screen.findByText('2 créditos de reagendamento disponíveis este mês')).toBeInTheDocument()
  })

  it('shows a message when there are no available credits', async () => {
    vi.spyOn(rescheduleApi, 'listRescheduleCredits').mockResolvedValue({ ok: true, credits: [] })
    vi.spyOn(rescheduleApi, 'getRescheduleConfig').mockResolvedValue({ ok: true, requiresApproval: false })

    renderSheet()

    expect(await screen.findByText(/nenhum crédito de reagendamento disponível/i)).toBeInTheDocument()
  })
})

describe('RemarcarSheet — lista de slots com vaga', () => {
  it('lists a slot with its computed vagas (capacity - participant count)', async () => {
    mockHappyPath({ capacity: 8, participantCount: 6 })
    renderSheet()

    expect(await screen.findByText('Turma Beach Tennis')).toBeInTheDocument()
    expect(screen.getByText(/2 vagas/)).toBeInTheDocument()
    expect(screen.getByText(/Quadra 1/)).toBeInTheDocument()
  })

  it('excludes a slot with no remaining capacity', async () => {
    mockHappyPath({ capacity: 8, participantCount: 8 })
    renderSheet()

    expect(await screen.findByText(/nenhum horário com vaga disponível/i)).toBeInTheDocument()
    expect(screen.queryByText('Turma Beach Tennis')).not.toBeInTheDocument()
  })
})

describe('RemarcarSheet — remarcar', () => {
  it('calls createReschedule with the earliest-expiring credit and the picked booking, then onRescheduled(applied)', async () => {
    mockHappyPath()
    const createSpy = vi
      .spyOn(rescheduleApi, 'createReschedule')
      .mockResolvedValue({ ok: true, status: 'applied', creditId: 'credit-1', targetBookingId: 'booking-1' })
    const { onRescheduled } = renderSheet()

    await screen.findByText('Turma Beach Tennis')
    await userEvent.click(screen.getByRole('button', { name: 'Remarcar' }))

    expect(createSpy).toHaveBeenCalledWith('student-1', 'credit-1', 'booking-1')
    expect(onRescheduled).toHaveBeenCalledWith({ status: 'applied' })
  })

  it('surfaces a clear error message when the credit already expired', async () => {
    mockHappyPath()
    vi.spyOn(rescheduleApi, 'createReschedule').mockResolvedValue({
      ok: false,
      status: 400,
      error: 'credit_expired',
    })
    renderSheet()

    await screen.findByText('Turma Beach Tennis')
    await userEvent.click(screen.getByRole('button', { name: 'Remarcar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/este crédito expirou/i)
  })

  it('shows the conditional approval foot-note and passes pending_approval through onRescheduled', async () => {
    vi.spyOn(rescheduleApi, 'listRescheduleCredits').mockResolvedValue({ ok: true, credits: [credit()] })
    vi.spyOn(rescheduleApi, 'getRescheduleConfig').mockResolvedValue({ ok: true, requiresApproval: true })
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, bookings: [booking()], viewOnly: false })
    vi.spyOn(classesApi, 'listClasses').mockResolvedValue({ ok: true, classes: [rallyeClass()] })
    vi.spyOn(bookingsApi, 'listBookingParticipants').mockResolvedValue({
      ok: true,
      participants: [participant('p0')],
    })
    const createSpy = vi.spyOn(rescheduleApi, 'createReschedule').mockResolvedValue({
      ok: true,
      status: 'pending_approval',
      creditId: 'credit-1',
      pendingApprovalId: 'pa-1',
    })
    const { onRescheduled } = renderSheet()

    expect(await screen.findByText(/exige aprovação do admin/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Remarcar' }))

    expect(createSpy).toHaveBeenCalled()
    expect(onRescheduled).toHaveBeenCalledWith({ status: 'pending_approval' })
  })
})
