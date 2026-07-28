import { screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as bookingsApi from '../lib/api/bookings'
import type { Booking } from '../lib/api/bookings'
import * as meApi from '../lib/api/me'
import * as tenantContext from '../lib/tenantContext'
import { renderWithPermissions } from '../test/renderWithPermissions'
import D1Dashboard from './D1Dashboard'

const { fetchStudentXPMock, listSkillLevelsMock } = vi.hoisted(() => ({
  fetchStudentXPMock: vi.fn(),
  listSkillLevelsMock: vi.fn(),
}))

vi.mock('../lib/api/xp', () => ({
  fetchStudentXP: fetchStudentXPMock,
}))

vi.mock('../lib/api/skillLevels', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api/skillLevels')>()
  return { ...actual, listSkillLevels: listSkillLevelsMock }
})

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
  fetchStudentXPMock.mockReset()
  listSkillLevelsMock.mockReset()
})

function mockIdentity(studentId: string) {
  vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: studentId, fullName: 'Ana Beatriz' })
}

function renderPage() {
  return renderWithPermissions(
    <MemoryRouter>
      <D1Dashboard />
    </MemoryRouter>,
  )
}

describe('D1Dashboard', () => {
  it('renders the medal and the skill-level chips in visually distinct containers', async () => {
    mockIdentity('student-1')
    vi.spyOn(tenantContext, 'getSessionMemberships').mockReturnValue([{ unit_id: 'unit-1', tenant_id: 'tenant-1' }])
    fetchStudentXPMock.mockResolvedValue({ ok: true, total_xp: 900, medal: 'Ouro' })
    listSkillLevelsMock.mockResolvedValue({
      ok: true,
      skillLevels: [{ sport: 'beach_tennis', tier: 'b', updatedBy: null, updatedAt: '2026-07-01T00:00:00Z' }],
    })
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, viewOnly: false, bookings: [] })

    renderPage()

    const medalSection = await screen.findByTestId('dashboard-medal')
    const skillSection = screen.getByTestId('dashboard-skill-levels')

    await waitFor(() => expect(within(medalSection).getByText('Ouro')).toBeInTheDocument())
    expect(within(skillSection).getByText('B')).toBeInTheDocument()
    expect(within(medalSection).queryByText('B')).not.toBeInTheDocument()
    expect(within(skillSection).queryByText('Ouro')).not.toBeInTheDocument()
  })

  it('aggregates the daily agenda from every arena the student has a membership in, labeling each item', async () => {
    mockIdentity('student-1')
    vi.spyOn(tenantContext, 'getSessionMemberships').mockReturnValue([
      { unit_id: 'unit-1', tenant_id: 'tenant-1' },
      { unit_id: 'unit-2', tenant_id: 'tenant-1' },
    ])
    fetchStudentXPMock.mockResolvedValue({ ok: true, total_xp: 100, medal: 'Bronze' })
    listSkillLevelsMock.mockResolvedValue({ ok: true, skillLevels: [] })
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

  it('renders the agenda without breaking for a student with a single arena membership', async () => {
    mockIdentity('student-1')
    vi.spyOn(tenantContext, 'getSessionMemberships').mockReturnValue([{ unit_id: 'unit-1', tenant_id: 'tenant-1' }])
    fetchStudentXPMock.mockResolvedValue({ ok: true, total_xp: 100, medal: 'Bronze' })
    listSkillLevelsMock.mockResolvedValue({ ok: true, skillLevels: [] })
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [booking({ id: 'b1', unitId: 'unit-1', unitName: 'Arena Areia Dourada' })],
    })

    renderPage()

    const agenda = await screen.findByTestId('dashboard-agenda')
    await waitFor(() => expect(within(agenda).getByText('Beach tennis intermediária')).toBeInTheDocument())
  })

  it('scopes every API call to the id returned by GET /me, never an id from props/URL', async () => {
    mockIdentity('own-profile-id')
    vi.spyOn(tenantContext, 'getSessionMemberships').mockReturnValue([{ unit_id: 'unit-1', tenant_id: 'tenant-1' }])
    fetchStudentXPMock.mockResolvedValue({ ok: true, total_xp: 100, medal: 'Bronze' })
    listSkillLevelsMock.mockResolvedValue({ ok: true, skillLevels: [] })
    const bookingsSpy = vi
      .spyOn(bookingsApi, 'getBookingsGrid')
      .mockResolvedValue({ ok: true, viewOnly: false, bookings: [] })

    renderPage()

    await waitFor(() => expect(fetchStudentXPMock).toHaveBeenCalledWith('own-profile-id'))
    expect(listSkillLevelsMock).toHaveBeenCalledWith('own-profile-id')
    expect(bookingsSpy).toHaveBeenCalledWith('unit-1', expect.any(String), expect.any(String), undefined, 'own-profile-id')
  })

  it('never renders PendingApprovalsCard', async () => {
    mockIdentity('student-1')
    vi.spyOn(tenantContext, 'getSessionMemberships').mockReturnValue([{ unit_id: 'unit-1', tenant_id: 'tenant-1' }])
    fetchStudentXPMock.mockResolvedValue({ ok: true, total_xp: 100, medal: 'Bronze' })
    listSkillLevelsMock.mockResolvedValue({ ok: true, skillLevels: [] })
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, viewOnly: false, bookings: [] })

    renderPage()

    await waitFor(() => expect(fetchStudentXPMock).toHaveBeenCalled())
    expect(screen.queryByText('Central de Pendências')).not.toBeInTheDocument()
  })
})
