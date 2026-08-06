import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchMePermissionsMock } = vi.hoisted(() => ({
  fetchMePermissionsMock: vi.fn(),
}))

vi.mock('../lib/api/permissions', async () => {
  const actual =
    await vi.importActual<typeof import('../lib/api/permissions')>('../lib/api/permissions')
  return { ...actual, fetchMePermissions: fetchMePermissionsMock }
})

import { usePermissionsContext } from '../hooks/usePermissionsContext'
import { SESSION_ESTABLISHED_EVENT } from '../lib/httpClient'
// O Provider passou a ler /me/permissions via TanStack Query — precisa de um
// QueryClient em contexto (novo por render, para não vazar cache entre testes).
import { QueryTestProvider } from '../test/queryTestClient'
import { PermissionsProvider } from './PermissionsContext'

function Probe() {
  const { state } = usePermissionsContext()
  return <span data-testid="status">{state.status === 'ready' ? state.kind : state.status}</span>
}

const UNIT_A = '11111111-1111-4111-8111-111111111111'
const UNIT_B = '22222222-2222-4222-8222-222222222222'

describe('PermissionsContext', () => {
  beforeEach(() => {
    fetchMePermissionsMock.mockReset()
    window.sessionStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts idle (nada liberado) antes de qualquer fetch', () => {
    render(
      <QueryTestProvider>
        <PermissionsProvider>
          <Probe />
        </PermissionsProvider>
      </QueryTestProvider>,
    )
    expect(screen.getByTestId('status').textContent).toBe('idle')
  })

  it('refetches and reaches ready/full when GET /me/permissions resolves a module map', async () => {
    fetchMePermissionsMock.mockResolvedValue({
      kind: 'full',
      permissions: { agenda: ['read', 'write'] },
    })

    render(
      <QueryTestProvider>
        <PermissionsProvider>
          <Probe />
        </PermissionsProvider>
      </QueryTestProvider>,
    )

    // Dispara o mesmo evento que httpClient.ts emite após login/refresh
    // bem-sucedidos — é assim que o Provider aprende que uma sessão existe.
    act(() => {
      window.dispatchEvent(new Event(SESSION_ESTABLISHED_EVENT))
    })

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('full'))
    expect(fetchMePermissionsMock).toHaveBeenCalledTimes(1)
  })

  it('reaches ready/temporary when the backend reports a temporary (Visitante) session', async () => {
    fetchMePermissionsMock.mockResolvedValue({
      kind: 'temporary',
      scope: 'tournament:abc',
    })

    render(
      <QueryTestProvider>
        <PermissionsProvider>
          <Probe />
        </PermissionsProvider>
      </QueryTestProvider>,
    )

    act(() => {
      window.dispatchEvent(new Event(SESSION_ESTABLISHED_EVENT))
    })

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('temporary'))
  })

  it('reaches error (nunca "liberado por omissão") when the fetch fails', async () => {
    fetchMePermissionsMock.mockRejectedValue(new Error('network down'))

    render(
      <QueryTestProvider>
        <PermissionsProvider>
          <Probe />
        </PermissionsProvider>
      </QueryTestProvider>,
    )

    act(() => {
      window.dispatchEvent(new Event(SESSION_ESTABLISHED_EVENT))
    })

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('error'))
  })

  it('a arena entra na CHAVE de cache: navegar para outra arena não serve o mapa de permissions da anterior', async () => {
    // Arena A: Aluno (só lê agenda). Arena B: Tenant Owner (config).
    fetchMePermissionsMock
      .mockResolvedValueOnce({ kind: 'full', permissions: { agenda: ['read'] } })
      .mockResolvedValueOnce({ kind: 'full', permissions: { config: ['read', 'write'] } })

    function PermissionsProbe() {
      const { state } = usePermissionsContext()
      return (
        <span data-testid="perms">
          {state.status === 'ready' && state.kind === 'full'
            ? Object.keys(state.permissions).join(',')
            : state.status}
        </span>
      )
    }

    window.history.replaceState({}, '', `/units/${UNIT_A}/dashboard`)
    render(
      <QueryTestProvider>
        <PermissionsProvider>
          <PermissionsProbe />
        </PermissionsProvider>
      </QueryTestProvider>,
    )
    act(() => {
      window.dispatchEvent(new Event(SESSION_ESTABLISHED_EVENT))
    })
    await waitFor(() => expect(screen.getByTestId('perms').textContent).toBe('agenda'))

    // Navegação de SPA pura (pushState), sem remontar nada — exatamente o
    // caminho que pulava a invalidação manual e servia o cache da arena A.
    act(() => {
      window.history.pushState({}, '', `/units/${UNIT_B}/dashboard`)
    })

    await waitFor(() => expect(screen.getByTestId('perms').textContent).toBe('config'))
    expect(fetchMePermissionsMock).toHaveBeenCalledTimes(2)
  })
})
