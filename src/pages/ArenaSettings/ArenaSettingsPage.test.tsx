import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchMePermissionsMock } = vi.hoisted(() => ({
  fetchMePermissionsMock: vi.fn(),
}))

vi.mock('../../lib/api/permissions', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api/permissions')>(
    '../../lib/api/permissions',
  )
  return { ...actual, fetchMePermissions: fetchMePermissionsMock }
})

import { PermissionsProvider } from '../../context/PermissionsContext'
import { SESSION_ESTABLISHED_EVENT } from '../../lib/httpClient'
import * as unitSettingsApi from '../../lib/api/unitSettings'
import ArenaSettingsPage from './ArenaSettingsPage'

const NEVER_BLOCKED_HINT =
  'Loja e inscrição em torneio nunca são bloqueadas por inadimplência, em nenhum nível. Reverte automaticamente ao pagar.'

async function renderPage(permissions: Record<string, string[]>, unitId = 'unit-1') {
  fetchMePermissionsMock.mockResolvedValue({ kind: 'full', permissions })

  const utils = render(
    <PermissionsProvider>
      <MemoryRouter initialEntries={[`/units/${unitId}/settings`]}>
        <Routes>
          <Route path="/units/:unitId/settings" element={<ArenaSettingsPage />} />
          <Route path="/perfil" element={<div>Perfil placeholder</div>} />
        </Routes>
      </MemoryRouter>
    </PermissionsProvider>,
  )

  act(() => {
    window.dispatchEvent(new Event(SESSION_ESTABLISHED_EVENT))
  })
  await waitFor(() => expect(fetchMePermissionsMock).toHaveBeenCalled())

  return utils
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ArenaSettingsPage — sem config:read', () => {
  beforeEach(() => {
    fetchMePermissionsMock.mockReset()
  })

  it('não renderiza a seção (nem o título) e não busca o nível — esconder sempre', async () => {
    const getSpy = vi.spyOn(unitSettingsApi, 'getDelinquencyBlockLevel')

    await renderPage({ config: [] })

    expect(screen.queryByText('Bloqueio por inadimplência')).not.toBeInTheDocument()
    expect(screen.queryByText(NEVER_BLOCKED_HINT)).not.toBeInTheDocument()
    expect(getSpy).not.toHaveBeenCalled()
  })
})

describe('ArenaSettingsPage — loading e erro', () => {
  beforeEach(() => {
    fetchMePermissionsMock.mockReset()
  })

  it('mostra status de carregamento enquanto o GET está pendente', async () => {
    vi.spyOn(unitSettingsApi, 'getDelinquencyBlockLevel').mockReturnValue(new Promise(() => {}))

    await renderPage({ config: ['read'] })

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('mostra um alerta quando o GET falha', async () => {
    vi.spyOn(unitSettingsApi, 'getDelinquencyBlockLevel').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'internal_error',
    })

    await renderPage({ config: ['read'] })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /não foi possível carregar as configurações/i,
    )
  })
})

describe('ArenaSettingsPage — config:read + config:write (editável)', () => {
  beforeEach(() => {
    fetchMePermissionsMock.mockReset()
  })

  it('renderiza os 3 radio-opt, com o valor persistido marcado, e o hint fixo', async () => {
    vi.spyOn(unitSettingsApi, 'getDelinquencyBlockLevel').mockResolvedValue({
      ok: true,
      level: 'new_bookings_only',
    })

    await renderPage({ config: ['read', 'write'] })

    expect(await screen.findByText('Bloqueio por inadimplência')).toBeInTheDocument()
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
    expect(screen.getByLabelText(/só novos agendamentos\/remarcações/i)).toBeChecked()
    expect(screen.getByLabelText(/também bloqueia check-in/i)).not.toBeChecked()
    expect(screen.getByLabelText(/bloqueio total de acesso à arena/i)).not.toBeChecked()
    expect(screen.getByText(NEVER_BLOCKED_HINT)).toBeInTheDocument()
  })

  it('trocar a opção e salvar persiste via PATCH e reflete o novo valor', async () => {
    vi.spyOn(unitSettingsApi, 'getDelinquencyBlockLevel').mockResolvedValue({
      ok: true,
      level: 'new_bookings_only',
    })
    const patchSpy = vi.spyOn(unitSettingsApi, 'patchDelinquencyBlockLevel').mockResolvedValue({
      ok: true,
      level: 'total',
    })
    const user = userEvent.setup()

    await renderPage({ config: ['read', 'write'] })
    await screen.findByText('Bloqueio por inadimplência')

    await user.click(screen.getByLabelText(/bloqueio total de acesso à arena/i))
    await user.click(screen.getByRole('button', { name: /^salvar$/i }))

    await waitFor(() => expect(patchSpy).toHaveBeenCalledTimes(1))
    expect(patchSpy).toHaveBeenCalledWith('unit-1', 'total')
    await waitFor(() =>
      expect(screen.getByLabelText(/bloqueio total de acesso à arena/i)).toBeChecked(),
    )
    // Sem mudança pendente em relação ao valor persistido: Salvar desabilita de novo.
    expect(screen.getByRole('button', { name: /^salvar$/i })).toBeDisabled()
  })

  it('mostra um alerta e mantém a seleção quando o PATCH falha', async () => {
    vi.spyOn(unitSettingsApi, 'getDelinquencyBlockLevel').mockResolvedValue({
      ok: true,
      level: 'new_bookings_only',
    })
    vi.spyOn(unitSettingsApi, 'patchDelinquencyBlockLevel').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'internal_error',
    })
    const user = userEvent.setup()

    await renderPage({ config: ['read', 'write'] })
    await screen.findByText('Bloqueio por inadimplência')

    await user.click(screen.getByLabelText(/bloqueio total de acesso à arena/i))
    await user.click(screen.getByRole('button', { name: /^salvar$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível salvar/i)
    expect(screen.getByLabelText(/bloqueio total de acesso à arena/i)).toBeChecked()
  })
})

describe('ArenaSettingsPage — config:read sem config:write (modo leitura)', () => {
  beforeEach(() => {
    fetchMePermissionsMock.mockReset()
  })

  it('mostra os 3 valores sem nenhum radio interativo e sem botão Salvar', async () => {
    vi.spyOn(unitSettingsApi, 'getDelinquencyBlockLevel').mockResolvedValue({
      ok: true,
      level: 'new_bookings_and_checkin',
    })

    await renderPage({ config: ['read'] })

    expect(await screen.findByText('Bloqueio por inadimplência')).toBeInTheDocument()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /salvar/i })).not.toBeInTheDocument()
    expect(screen.getByTestId('bloqueio-readonly-new_bookings_and_checkin')).toHaveClass('checked')
    expect(screen.getByTestId('bloqueio-readonly-new_bookings_only')).not.toHaveClass('checked')
    expect(screen.getByText(NEVER_BLOCKED_HINT)).toBeInTheDocument()
  })
})
