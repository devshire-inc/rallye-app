import { act, screen, waitFor } from '@testing-library/react'
import { useReducer } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppShellLayout } from '../components/AppShell/AppShellLayout'
import { renderWithPermissions } from '../test/renderWithPermissions'
import * as useShellIdentityModule from '../hooks/useShellIdentity'
import * as notificationsApi from '../lib/api/notifications'
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

/**
 * Regressão do remount da casca, na transição `loading -> variante`.
 *
 * Historicamente o loading renderizava o próprio `<AppShell>` e cada variante
 * renderizava a dela, em posições DIFERENTES da árvore — o React desmontava e
 * remontava a shell inteira na transição, a nav piscava e todo efeito de
 * montagem dela (o `GET /me/notifications/unread-count` do sino) rodava de
 * novo. A correção foi hoiçar o `AppShell` para cima do estado de loading
 * DENTRO desta página.
 *
 * Desde que o `AppShell` subiu de vez para a rota de layout
 * (../components/AppShell/AppShellLayout.tsx), a casca não é mais montada por
 * esta página — então o teste passou a renderizar `DashboardPage` DEBAIXO da
 * rota de layout real, e não mais solta. A asserção não mudou: é a mesma
 * sonda (o nó DOM do sino) verificando a mesma propriedade, agora exercitando
 * a estrutura real. A versão FORTE dela — a casca sobrevive à navegação entre
 * duas rotas, não só a uma troca de estado — vive no teste do próprio layout.
 */
describe('DashboardPage — a casca sobrevive à transição loading -> variante', () => {
  let identity: useShellIdentityModule.ShellIdentity = {
    orgLabel: '',
    userLabel: '',
    role: null,
    loading: true,
  }
  let resolveIdentity: () => void = () => {}

  /** Re-renderiza `DashboardPage` sob os MESMOS providers (nada acima dele é
   * recriado), que é a única forma de exercitar a transição sem forçar um
   * remount pelo próprio harness de teste. */
  function IdentityHarness() {
    const [, forceRender] = useReducer((n: number) => n + 1, 0)
    resolveIdentity = forceRender
    return <DashboardPage />
  }

  it('mantém o AppShell montado e busca o unread-count uma única vez', async () => {
    const unreadCount = vi
      .spyOn(notificationsApi, 'getUnreadNotificationCount')
      .mockResolvedValue({ ok: true, unreadCount: 0 })
    identity = { orgLabel: '', userLabel: '', role: null, loading: true }
    vi.spyOn(useShellIdentityModule, 'useShellIdentity').mockImplementation(() => identity)

    renderWithPermissions(
      <MemoryRouter initialEntries={['/units/unit-1/dashboard']}>
        <Routes>
          <Route element={<AppShellLayout />}>
            <Route path="/units/:unitId/dashboard" element={<IdentityHarness />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    const bellWhileLoading = await screen.findByRole('button', { name: /notificações/i })
    expect(screen.getByRole('status')).toHaveTextContent('Carregando seu painel')

    identity = { orgLabel: 'Arena', userLabel: 'Ana · Aluno', role: 'Aluno', loading: false }
    act(() => resolveIdentity())

    expect(screen.getByTestId('d1-dashboard')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /notificações/i })).toBe(bellWhileLoading)
    await waitFor(() => expect(unreadCount).toHaveBeenCalledTimes(1))
  })
})
