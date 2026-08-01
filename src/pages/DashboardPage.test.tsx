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

vi.mock('./D2Dashboard', () => ({
  default: () => <div data-testid="d2-dashboard" />,
}))

vi.mock('./D3Dashboard', () => ({
  default: () => <div data-testid="d3-dashboard" />,
}))

vi.mock('./D3FDashboard', () => ({
  default: () => <div data-testid="d3f-dashboard" />,
}))

vi.mock('./OW1Dashboard', () => ({
  default: () => <div data-testid="ow1-dashboard" />,
}))

afterEach(() => {
  vi.restoreAllMocks()
})

function mockRole(role: string | null, loading = false) {
  vi.spyOn(useShellIdentityModule, 'useShellIdentity').mockReturnValue({
    orgLabel: '',
    userLabel: '',
    role,
    loading,
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
  it('renders a loading state — never the generic dashboard — while the identity is in flight', () => {
    mockRole(null, true)
    renderAt('/units/unit-1/dashboard')

    expect(screen.getByRole('status')).toHaveTextContent('Carregando seu painel')
    // o bug: com role ainda null, TODO usuário via o genérico por um instante
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sair/i })).not.toBeInTheDocument()
    expect(screen.queryByTestId('pending-approvals-card')).not.toBeInTheDocument()
  })

  it('renders the unchanged generic markup for GENERIC (role=null, resolved)', () => {
    mockRole(null)
    renderAt('/units/unit-1/dashboard')

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByTestId('pending-approvals-card')).toHaveTextContent('unit-1')
    expect(screen.getByRole('button', { name: /sair/i })).toBeInTheDocument()
  })

  it('renders D2Dashboard for Professor', () => {
    mockRole('Professor')
    renderAt('/units/unit-1/dashboard')

    expect(screen.getByTestId('d2-dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('pending-approvals-card')).not.toBeInTheDocument()
  })

  it('does not render PendingApprovalsCard for GENERIC when there is no unitId', () => {
    mockRole(null)
    renderAt('/dashboard')

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.queryByTestId('pending-approvals-card')).not.toBeInTheDocument()
  })

  it('renders D3Dashboard for Unit Admin', () => {
    mockRole('Unit Admin')
    renderAt('/units/unit-1/dashboard')

    expect(screen.getByTestId('d3-dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('pending-approvals-card')).not.toBeInTheDocument()
  })

  it('renders D3Dashboard for Platform Admin', () => {
    mockRole('Platform Admin')
    renderAt('/units/unit-1/dashboard')

    expect(screen.getByTestId('d3-dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('pending-approvals-card')).not.toBeInTheDocument()
  })

  it('renders D1Dashboard for Aluno, never PendingApprovalsCard', () => {
    mockRole('Aluno')
    renderAt('/units/unit-1/dashboard')

    expect(screen.getByTestId('d1-dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('pending-approvals-card')).not.toBeInTheDocument()
  })

  it('renders D3FDashboard for a custom role (D3F, detected by exclusion)', () => {
    mockRole('Recepcionista')
    renderAt('/units/unit-1/dashboard')

    expect(screen.getByTestId('d3f-dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('pending-approvals-card')).not.toBeInTheDocument()
  })

  it('renders OW1Dashboard for Tenant Owner', () => {
    mockRole('Tenant Owner')
    renderAt('/units/unit-1/dashboard')

    expect(screen.getByTestId('ow1-dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('pending-approvals-card')).not.toBeInTheDocument()
  })
})
