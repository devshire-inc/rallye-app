import { act, screen, waitFor } from '@testing-library/react'
import { renderWithQuery } from '../test/renderWithQuery'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchMePermissionsMock } = vi.hoisted(() => ({
  fetchMePermissionsMock: vi.fn(),
}))

vi.mock('../lib/api/permissions', async () => {
  const actual = await vi.importActual<typeof import('../lib/api/permissions')>(
    '../lib/api/permissions',
  )
  return { ...actual, fetchMePermissions: fetchMePermissionsMock }
})

import { PermissionsProvider } from '../context/PermissionsContext'
import { SESSION_ESTABLISHED_EVENT } from '../lib/httpClient'
import * as tenantContext from '../lib/tenantContext'
import * as pendingApprovalsApi from '../lib/api/pendingApprovals'
import D3FDashboard from './D3FDashboard'

async function renderDashboard(permissions: Record<string, string[]>) {
  fetchMePermissionsMock.mockResolvedValue({ kind: 'full', permissions })

  const utils = renderWithQuery(
    <PermissionsProvider>
      <MemoryRouter>
        <D3FDashboard />
      </MemoryRouter>
    </PermissionsProvider>,
  )

  act(() => {
    window.dispatchEvent(new Event(SESSION_ESTABLISHED_EVENT))
  })
  await waitFor(() => expect(fetchMePermissionsMock).toHaveBeenCalled())

  return utils
}

function fullPermissions(overrides: Record<string, string[]> = {}): Record<string, string[]> {
  return {
    alunos: [],
    professores: [],
    agenda: [],
    financeiro: [],
    torneios: [],
    loja: [],
    config: [],
    relatorios: [],
    quadras: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.spyOn(tenantContext, 'getActiveUnitId').mockReturnValue('unit-1')
  vi.spyOn(pendingApprovalsApi, 'listPendingApprovals').mockResolvedValue({ ok: true, items: [] })
})

afterEach(() => {
  vi.restoreAllMocks()
  fetchMePermissionsMock.mockReset()
})

describe('D3FDashboard', () => {
  it('shows only the one granted module section', async () => {
    await renderDashboard(fullPermissions({ agenda: ['read'] }))

    expect(await screen.findByTestId('dashboard-section-agenda')).toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-section-professores')).not.toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-section-financeiro')).not.toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-section-torneios')).not.toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-section-config')).not.toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-section-relatorios')).not.toBeInTheDocument()
  })

  it('shows exactly the 3 granted module sections, no more no less', async () => {
    await renderDashboard(
      fullPermissions({ agenda: ['read'], financeiro: ['read'], relatorios: ['read'] }),
    )

    expect(await screen.findByTestId('dashboard-section-agenda')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-section-financeiro')).toBeInTheDocument()
    expect(screen.getByTestId('dashboard-section-relatorios')).toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-section-professores')).not.toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-section-torneios')).not.toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-section-config')).not.toBeInTheDocument()
  })

  it('never renders a section for loja, even with full loja permissions', async () => {
    await renderDashboard(
      fullPermissions({ agenda: ['read'], loja: ['read', 'write'] }),
    )

    expect(await screen.findByTestId('dashboard-section-agenda')).toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-section-loja')).not.toBeInTheDocument()
    expect(screen.queryByText('Loja')).not.toBeInTheDocument()
  })

  it('renders a link matching the real route confirmed in App.tsx for each visible module', async () => {
    await renderDashboard(
      fullPermissions({
        professores: ['read'],
        agenda: ['read'],
        financeiro: ['read'],
        torneios: ['read'],
        config: ['read'],
        relatorios: ['read'],
      }),
    )

    expect(await screen.findByRole('link', { name: 'Agenda' })).toHaveAttribute(
      'href',
      '/units/unit-1/agenda',
    )
    expect(screen.getByRole('link', { name: 'Professores' })).toHaveAttribute(
      'href',
      '/units/unit-1/teachers',
    )
    expect(screen.getByRole('link', { name: 'Financeiro' })).toHaveAttribute(
      'href',
      '/units/unit-1/cashflow',
    )
    expect(screen.getByRole('link', { name: 'Torneios' })).toHaveAttribute(
      'href',
      '/units/unit-1/tournaments',
    )
    expect(screen.getByRole('link', { name: 'Relatórios' })).toHaveAttribute(
      'href',
      '/units/unit-1/reports',
    )
    expect(screen.getByRole('link', { name: 'Config' })).toHaveAttribute(
      'href',
      '/units/unit-1/settings',
    )
  })

  it('includes PendingApprovalsCard', async () => {
    vi.spyOn(pendingApprovalsApi, 'listPendingApprovals').mockResolvedValue({
      ok: true,
      items: [
        {
          id: 'p1',
          type: 'reschedule',
          status: 'pending',
          requestedBy: 'student-1',
          reviewedBy: null,
          reviewedAt: null,
          createdAt: new Date().toISOString(),
          teacherBlock: null,
          reschedule: {
            studentId: 'student-1',
            studentName: 'Ana',
            targetClassName: 'Turma A',
            targetStartAt: new Date().toISOString(),
          },
        },
      ],
    })

    await renderDashboard(fullPermissions({ agenda: ['read'] }))

    expect(await screen.findByText('Central de Pendências')).toBeInTheDocument()
  })
})
