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

import { PermissionsProvider } from '../context/PermissionsContext'
import { SESSION_ESTABLISHED_EVENT } from '../lib/httpClient'
import { usePermission } from './usePermission'

/** Regra de ouro do épico (AC de BEAC-1841): "esconder sempre, nunca
 * desabilitar" — um componente condicionado por usePermission retornando
 * false DEVE retornar null, nunca um botão/campo desabilitado visível. */
function GatedButton({ module, action }: { module: Parameters<typeof usePermission>[0]; action: Parameters<typeof usePermission>[1] }) {
  const allowed = usePermission(module, action)
  if (!allowed) return null
  return <button type="button">Ação restrita</button>
}

async function renderWithPermissions(
  fetchResult: Awaited<ReturnType<typeof fetchMePermissionsMock>> | null,
  ui: React.ReactNode,
) {
  if (fetchResult) fetchMePermissionsMock.mockResolvedValue(fetchResult)
  const utils = render(<PermissionsProvider>{ui}</PermissionsProvider>)
  if (fetchResult) {
    act(() => {
      window.dispatchEvent(new Event(SESSION_ESTABLISHED_EVENT))
    })
    await waitFor(() => expect(fetchMePermissionsMock).toHaveBeenCalled())
  }
  return utils
}

describe('usePermission', () => {
  beforeEach(() => {
    fetchMePermissionsMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns true synchronously for (module, action) granted by the cached full permissions map', async () => {
    await renderWithPermissions(
      { kind: 'full', permissions: { financeiro: ['read', 'write'] } },
      <GatedButton module="financeiro" action="write" />,
    )

    await waitFor(() => expect(screen.getByRole('button')).toBeInTheDocument())
  })

  it('renders nothing (not a disabled control) when the action is not granted', async () => {
    const { container } = await renderWithPermissions(
      { kind: 'full', permissions: { financeiro: ['read'] } },
      <GatedButton module="financeiro" action="write" />,
    )

    await waitFor(() => expect(fetchMePermissionsMock).toHaveBeenCalled())
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(container.querySelector('button[disabled]')).toBeNull()
  })

  it('returns false before any fetch resolves (idle state) — hides by default', () => {
    render(
      <PermissionsProvider>
        <GatedButton module="agenda" action="read" />
      </PermissionsProvider>,
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('always returns false for a temporary (Visitante) session, regardless of module/action', async () => {
    await renderWithPermissions(
      { kind: 'temporary', scope: 'tournament:abc' },
      <GatedButton module="agenda" action="read" />,
    )

    await waitFor(() => expect(fetchMePermissionsMock).toHaveBeenCalled())
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('throws a clear error when used outside a PermissionsProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<GatedButton module="agenda" action="read" />)).toThrow(
      /PermissionsProvider/,
    )
    spy.mockRestore()
  })
})
