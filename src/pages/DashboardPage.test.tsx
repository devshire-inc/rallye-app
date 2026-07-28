import { screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithPermissions } from '../test/renderWithPermissions'
import * as useShellIdentityModule from '../hooks/useShellIdentity'
import DashboardPage from './DashboardPage'

vi.mock('./PendingApprovalsCard', () => ({
  PendingApprovalsCard: ({ unitId }: { unitId: string }) => (
    <div data-testid="pending-approvals-card">{unitId}</div>
  ),
}))

vi.mock('./D1Dashboard', () => ({
  default: () => <div data-testid="d1-dashboard" />,
}))

afterEach(() => {
  vi.restoreAllMocks()
})

function mockRole(role: string | null) {
  vi.spyOn(useShellIdentityModule, 'useShellIdentity').mockReturnValue({
    orgLabel: '',
    userLabel: '',
    role,
  })
}

function renderAt(path: string) {
  return renderWithPermissions(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/units/:unitId/dashboard" element={<DashboardPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('DashboardPage', () => {
  it('renders the unchanged generic markup for GENERIC (role=null)', () => {
    mockRole(null)
    renderAt('/units/unit-1/dashboard')

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByTestId('pending-approvals-card')).toHaveTextContent('unit-1')
    expect(screen.getByRole('button', { name: /sair/i })).toBeInTheDocument()
  })

  it('renders the unchanged generic markup for Professor (D2, not yet implemented)', () => {
    mockRole('Professor')
    renderAt('/units/unit-1/dashboard')

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByTestId('pending-approvals-card')).toBeInTheDocument()
  })

  it('does not render PendingApprovalsCard when there is no unitId, regardless of role', () => {
    mockRole('Unit Admin')
    renderAt('/dashboard')

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.queryByTestId('pending-approvals-card')).not.toBeInTheDocument()
  })

  it('renders D1Dashboard for Aluno, never PendingApprovalsCard', () => {
    mockRole('Aluno')
    renderAt('/units/unit-1/dashboard')

    expect(screen.getByTestId('d1-dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('pending-approvals-card')).not.toBeInTheDocument()
  })
})
