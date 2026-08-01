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

describe('PermissionsContext', () => {
  beforeEach(() => {
    fetchMePermissionsMock.mockReset()
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
})
