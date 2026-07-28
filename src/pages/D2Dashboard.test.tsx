import { screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as bookingsApi from '../lib/api/bookings'
import type { Booking } from '../lib/api/bookings'
import * as meApi from '../lib/api/me'
import * as tenantContext from '../lib/tenantContext'
import { renderWithPermissions } from '../test/renderWithPermissions'
import D2Dashboard from './D2Dashboard'

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

afterEach(() => {
  vi.restoreAllMocks()
})

function mockIdentity(teacherId: string) {
  vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: teacherId, fullName: 'Marcus Lima' })
}

function renderPage() {
  return renderWithPermissions(
    <MemoryRouter>
      <D2Dashboard />
    </MemoryRouter>,
  )
}

describe('D2Dashboard', () => {
  it('aggregates the daily agenda from every arena the teacher has a membership in, labeling each item with its arena', async () => {
    mockIdentity('teacher-1')
    vi.spyOn(tenantContext, 'getActiveUnitId').mockReturnValue('unit-1')
    vi.spyOn(tenantContext, 'getSessionMemberships').mockReturnValue([
      { unit_id: 'unit-1', tenant_id: 'tenant-1' },
      { unit_id: 'unit-2', tenant_id: 'tenant-1' },
    ])
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockImplementation((unitId) => {
      if (unitId === 'unit-1') {
        return Promise.resolve({
          ok: true,
          viewOnly: false,
          bookings: [booking({ id: 'b1', unitId: 'unit-1', unitName: 'Arena Areia Dourada' })],
        })
      }
      return Promise.resolve({
        ok: true,
        viewOnly: false,
        bookings: [booking({ id: 'b2', unitId: 'unit-2', unitName: 'Arena Praia Norte' })],
      })
    })

    renderPage()

    const agenda = await screen.findByTestId('dashboard-agenda')
    await waitFor(() => expect(within(agenda).getByText('Arena Areia Dourada')).toBeInTheDocument())
    expect(within(agenda).getByText('Arena Praia Norte')).toBeInTheDocument()
  })

  it('shows zero pending check-ins when no booking is within the check-in window', async () => {
    mockIdentity('teacher-1')
    vi.spyOn(tenantContext, 'getActiveUnitId').mockReturnValue('unit-1')
    vi.spyOn(tenantContext, 'getSessionMemberships').mockReturnValue([{ unit_id: 'unit-1', tenant_id: 'tenant-1' }])
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [
        booking({
          id: 'future',
          startAt: new Date(Date.now() + 3 * 3600_000).toISOString(),
          checkedIn: false,
        }),
      ],
    })

    renderPage()

    const pending = await screen.findByTestId('dashboard-checkin-pending')
    await waitFor(() => expect(within(pending).getByText('0')).toBeInTheDocument())
  })

  it('counts a booking within the check-in window and not yet checked in as pending', async () => {
    mockIdentity('teacher-1')
    vi.spyOn(tenantContext, 'getActiveUnitId').mockReturnValue('unit-1')
    vi.spyOn(tenantContext, 'getSessionMemberships').mockReturnValue([{ unit_id: 'unit-1', tenant_id: 'tenant-1' }])
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [
        booking({ id: 'available', startAt: new Date().toISOString(), checkedIn: false }),
        booking({ id: 'done', startAt: new Date().toISOString(), checkedIn: true }),
      ],
    })

    renderPage()

    const pending = await screen.findByTestId('dashboard-checkin-pending')
    await waitFor(() => expect(within(pending).getByText('1')).toBeInTheDocument())
  })

  it('shows a "Meus Ganhos" link to the self-view earnings route', async () => {
    mockIdentity('teacher-1')
    vi.spyOn(tenantContext, 'getActiveUnitId').mockReturnValue('unit-1')
    vi.spyOn(tenantContext, 'getSessionMemberships').mockReturnValue([{ unit_id: 'unit-1', tenant_id: 'tenant-1' }])
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, viewOnly: false, bookings: [] })

    renderPage()

    expect(await screen.findByRole('link', { name: /meus ganhos/i })).toHaveAttribute(
      'href',
      '/units/unit-1/me/earnings',
    )
  })

  it('scopes bookings to the id returned by GET /me, never an id from props/URL', async () => {
    mockIdentity('own-teacher-id')
    vi.spyOn(tenantContext, 'getActiveUnitId').mockReturnValue('unit-1')
    vi.spyOn(tenantContext, 'getSessionMemberships').mockReturnValue([{ unit_id: 'unit-1', tenant_id: 'tenant-1' }])
    const bookingsSpy = vi
      .spyOn(bookingsApi, 'getBookingsGrid')
      .mockResolvedValue({ ok: true, viewOnly: false, bookings: [] })

    renderPage()

    await waitFor(() =>
      expect(bookingsSpy).toHaveBeenCalledWith(
        'unit-1',
        expect.any(String),
        expect.any(String),
        undefined,
        undefined,
        'own-teacher-id',
      ),
    )
  })
})
