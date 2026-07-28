import { act, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { fetchMePermissionsMock } = vi.hoisted(() => ({
  fetchMePermissionsMock: vi.fn(),
}))

vi.mock('../lib/api/permissions', async () => {
  const actual = await vi.importActual<typeof import('../lib/api/permissions')>('../lib/api/permissions')
  return { ...actual, fetchMePermissions: fetchMePermissionsMock }
})

import { PermissionsProvider } from '../context/PermissionsContext'
import { SESSION_ESTABLISHED_EVENT } from '../lib/httpClient'
import * as bookingsApi from '../lib/api/bookings'
import type { Booking } from '../lib/api/bookings'
import * as pendingApprovalsApi from '../lib/api/pendingApprovals'
import * as reportsApi from '../lib/api/reports'
import type { Report } from '../lib/api/reports'
import * as tenantContext from '../lib/tenantContext'
import { renderWithPermissions } from '../test/renderWithPermissions'
import D3Dashboard from './D3Dashboard'

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

function report(overrides: Partial<Report> = {}): Report {
  return {
    type: 'fluxo-de-caixa',
    period: '2026-07',
    available: true,
    reason: null,
    totalAmount: null,
    totalClassesCount: null,
    teacherRevenue: [],
    cashFlow: null,
    delinquency: null,
    revenueBySport: null,
    dre: null,
    dayUse: null,
    ...overrides,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  fetchMePermissionsMock.mockReset()
})

function baseMocks() {
  vi.spyOn(tenantContext, 'getActiveUnitId').mockReturnValue('unit-1')
  vi.spyOn(pendingApprovalsApi, 'listPendingApprovals').mockResolvedValue({ ok: true, items: [] })
  vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, viewOnly: false, bookings: [] })
  vi.spyOn(reportsApi, 'getReport').mockImplementation((_unitId, type) => {
    if (type === 'fluxo-de-caixa') {
      return Promise.resolve({
        ok: true,
        report: report({
          type: 'fluxo-de-caixa',
          cashFlow: { summary: { receita: 15000, despesas: 4000, saldo: 11000, recebido: 12000, aReceber: 3000, emAtraso: 1000 }, categories: [] },
        }),
      })
    }
    return Promise.resolve({
      ok: true,
      report: report({
        type: 'inadimplencia',
        delinquency: { summary: { totalAmount: 3200, studentsCount: 4 }, items: [] },
      }),
    })
  })
}

function renderPage() {
  return renderWithPermissions(
    <MemoryRouter>
      <D3Dashboard />
    </MemoryRouter>,
  )
}

describe('D3Dashboard', () => {
  it('shows the 4 KPI tiles from the correct report/bookings/pending-approvals calls, scoped to the active unit', async () => {
    baseMocks()
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [booking({ id: 'b1' }), booking({ id: 'b2' })],
    })
    vi.spyOn(pendingApprovalsApi, 'listPendingApprovals').mockResolvedValue({
      ok: true,
      items: [
        {
          id: 'p1',
          type: 'reschedule',
          status: 'pending',
          requestedBy: 'u',
          reviewedBy: null,
          reviewedAt: null,
          createdAt: new Date().toISOString(),
          teacherBlock: null,
          reschedule: { studentId: 's', studentName: 'Ana', targetClassName: null, targetStartAt: null },
        },
      ],
    })

    renderPage()

    const kpis = await screen.findByTestId('dashboard-kpis')
    await waitFor(() => expect(within(kpis).getByText('R$ 15.000,00')).toBeInTheDocument())
    expect(within(kpis).getByText('R$ 3.200,00')).toBeInTheDocument()
    expect(within(kpis).getByText('2')).toBeInTheDocument()
    expect(within(kpis).getByText('1')).toBeInTheDocument()

    expect(reportsApi.getReport).toHaveBeenCalledWith('unit-1', 'fluxo-de-caixa')
    expect(reportsApi.getReport).toHaveBeenCalledWith('unit-1', 'inadimplencia')
  })

  it('renders at least 3 quick action links to real routes confirmed in App.tsx', async () => {
    baseMocks()

    renderPage()

    const actions = await screen.findByTestId('dashboard-quick-actions')
    expect(within(actions).getByRole('link', { name: /agenda/i })).toHaveAttribute('href', '/units/unit-1/agenda')
    expect(within(actions).getByRole('link', { name: /relat/i })).toHaveAttribute('href', '/units/unit-1/reports')
    expect(within(actions).getByRole('link', { name: /membros/i })).toHaveAttribute('href', '/units/unit-1/members')
  })

  it('fetches bookings for today exactly once and feeds both the KPI count and the agenda list', async () => {
    baseMocks()
    const bookingsSpy = vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({
      ok: true,
      viewOnly: false,
      bookings: [booking({ id: 'b1', className: 'Aula X' })],
    })

    renderPage()

    const agenda = await screen.findByTestId('dashboard-agenda')
    await waitFor(() => expect(within(agenda).getByText('Aula X')).toBeInTheDocument())
    expect(bookingsSpy).toHaveBeenCalledTimes(1)
  })

  it('embeds PendingApprovalsCard, visible for a user with agenda:read', async () => {
    baseMocks()
    vi.spyOn(pendingApprovalsApi, 'listPendingApprovals').mockResolvedValue({
      ok: true,
      items: [
        {
          id: 'p1',
          type: 'reschedule',
          status: 'pending',
          requestedBy: 'u',
          reviewedBy: null,
          reviewedAt: null,
          createdAt: new Date().toISOString(),
          teacherBlock: null,
          reschedule: { studentId: 's', studentName: 'Ana', targetClassName: null, targetStartAt: null },
        },
      ],
    })
    fetchMePermissionsMock.mockResolvedValue({ kind: 'full', permissions: { agenda: ['read'] } })

    render(
      <PermissionsProvider>
        <MemoryRouter>
          <D3Dashboard />
        </MemoryRouter>
      </PermissionsProvider>,
    )
    act(() => {
      window.dispatchEvent(new Event(SESSION_ESTABLISHED_EVENT))
    })
    await waitFor(() => expect(fetchMePermissionsMock).toHaveBeenCalled())

    expect(await screen.findByText('Central de Pendências')).toBeInTheDocument()
  })
})
