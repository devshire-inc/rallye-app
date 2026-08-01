import { act, screen, waitFor, within } from '@testing-library/react'
import { renderWithQuery } from '../../test/renderWithQuery'
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
import * as dayUseApi from '../../lib/api/dayUse'
import type { DayUseConfig } from '../../lib/api/dayUse'
import DayUseConfigPage from './DayUseConfigPage'

const SEPARATE_SCREEN_TOAST_TEXT =
  'Tela própria, fora de "Configurações da arena" — cada quadra tem seu esporte, horário, preço e vagas de Day Use configurados individualmente.'

const BOOKING_VISIBILITY_HINT_TEXT =
  'Reserva de Day Use aparece na agenda normal (AG1/AG2) com tag visual, além desta config e da listagem administrativa (DU6).'

function makeConfig(overrides: Partial<DayUseConfig> = {}): DayUseConfig {
  return {
    courtId: 'court-1',
    courtName: 'Quadra 1',
    sport: 'beach_tennis',
    enabled: false,
    price: null,
    slotsPerDay: null,
    startTime: null,
    endTime: null,
    availableDays: [],
    ...overrides,
  }
}

async function renderPage(permissions: Record<string, string[]>, unitId = 'unit-1') {
  fetchMePermissionsMock.mockResolvedValue({ kind: 'full', permissions })

  const utils = renderWithQuery(
    <PermissionsProvider>
      <MemoryRouter initialEntries={[`/units/${unitId}/day-use`]}>
        <Routes>
          <Route path="/units/:unitId/day-use" element={<DayUseConfigPage />} />
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

describe('DayUseConfigPage — sem financeiro:write', () => {
  beforeEach(() => {
    fetchMePermissionsMock.mockReset()
  })

  it('não renderiza nada (nem o toast/hint) e não busca as configs — esconder sempre', async () => {
    const listSpy = vi.spyOn(dayUseApi, 'listDayUseConfigs')

    await renderPage({ financeiro: [] })

    expect(screen.queryByText(SEPARATE_SCREEN_TOAST_TEXT)).not.toBeInTheDocument()
    expect(screen.queryByText(BOOKING_VISIBILITY_HINT_TEXT)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ver reservas/i })).not.toBeInTheDocument()
    expect(listSpy).not.toHaveBeenCalled()
  })

  it('financeiro apenas com read (sem write) também esconde tudo', async () => {
    await renderPage({ financeiro: ['read'] })

    expect(screen.queryByText(SEPARATE_SCREEN_TOAST_TEXT)).not.toBeInTheDocument()
  })
})

describe('DayUseConfigPage — loading e erro', () => {
  beforeEach(() => {
    fetchMePermissionsMock.mockReset()
  })

  it('mostra status de carregamento enquanto o GET está pendente', async () => {
    vi.spyOn(dayUseApi, 'listDayUseConfigs').mockReturnValue(new Promise(() => {}))

    await renderPage({ financeiro: ['write'] })

    expect(screen.getByText(/carregando quadras/i)).toBeInTheDocument()
  })

  it('mostra um alerta quando o GET falha', async () => {
    vi.spyOn(dayUseApi, 'listDayUseConfigs').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'internal_error',
    })

    await renderPage({ financeiro: ['write'] })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /não foi possível carregar a configuração de day use/i,
    )
  })
})

describe('DayUseConfigPage — financeiro:write (tela completa)', () => {
  beforeEach(() => {
    fetchMePermissionsMock.mockReset()
  })

  it('renderiza o toast fixo, o hint fixo e o botão "Ver reservas"', async () => {
    vi.spyOn(dayUseApi, 'listDayUseConfigs').mockResolvedValue({ ok: true, configs: [] })

    await renderPage({ financeiro: ['write'] })

    expect(await screen.findByText(SEPARATE_SCREEN_TOAST_TEXT)).toBeInTheDocument()
    expect(screen.getByText(BOOKING_VISIBILITY_HINT_TEXT)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ver reservas/i })).toBeInTheDocument()
  })

  it('um card por quadra — desligada esconde os campos, ligada mostra preço/vagas/horário/dias', async () => {
    vi.spyOn(dayUseApi, 'listDayUseConfigs').mockResolvedValue({
      ok: true,
      configs: [
        makeConfig({ courtId: 'court-1', courtName: 'Quadra 1', enabled: false }),
        makeConfig({
          courtId: 'court-2',
          courtName: 'Quadra 2',
          sport: 'padel',
          enabled: true,
          price: 45,
          slotsPerDay: 12,
          startTime: '08:00',
          endTime: '18:00',
          availableDays: [1, 2, 3, 4, 5],
        }),
      ],
    })

    await renderPage({ financeiro: ['write'] })

    const offCard = await screen.findByTestId('day-use-card-court-1')
    expect(offCard).not.toHaveTextContent('Preço')

    const onCard = screen.getByTestId('day-use-card-court-2')
    expect(onCard).toHaveTextContent('Preço')
    expect(onCard).toHaveTextContent('Vagas/dia')
    expect(onCard).toHaveTextContent('Horário liberado')
    expect(onCard).toHaveTextContent('Dias disponíveis')
    expect(within(onCard).getByLabelText(/ativar day use em quadra 2/i)).toBeChecked()
    expect(within(onCard).getByText('Seg')).toHaveClass('active')
    expect(within(onCard).getByText('Sáb')).not.toHaveClass('active')
  })

  it('ligar o toggle dispara PATCH {enabled:true} e reflete o card atualizado', async () => {
    vi.spyOn(dayUseApi, 'listDayUseConfigs').mockResolvedValue({
      ok: true,
      configs: [makeConfig({ enabled: false })],
    })
    const patchSpy = vi.spyOn(dayUseApi, 'patchDayUseConfig').mockResolvedValue({
      ok: true,
      config: makeConfig({ enabled: true }),
    })
    const user = userEvent.setup()

    await renderPage({ financeiro: ['write'] })
    const card = await screen.findByTestId('day-use-card-court-1')

    await user.click(within(card).getByLabelText(/ativar day use em quadra 1/i))

    await waitFor(() => expect(patchSpy).toHaveBeenCalledWith('court-1', { enabled: true }))
    await waitFor(() =>
      expect(within(card).getByLabelText(/ativar day use em quadra 1/i)).toBeChecked(),
    )
  })

  it('editar o preço e sair do campo dispara PATCH só com price, preservando os demais campos no servidor', async () => {
    vi.spyOn(dayUseApi, 'listDayUseConfigs').mockResolvedValue({
      ok: true,
      configs: [
        makeConfig({
          enabled: true,
          price: 45,
          slotsPerDay: 12,
          startTime: '08:00',
          endTime: '18:00',
          availableDays: [1, 2],
        }),
      ],
    })
    const patchSpy = vi.spyOn(dayUseApi, 'patchDayUseConfig').mockResolvedValue({
      ok: true,
      config: makeConfig({
        enabled: true,
        price: 60,
        slotsPerDay: 12,
        startTime: '08:00',
        endTime: '18:00',
        availableDays: [1, 2],
      }),
    })
    const user = userEvent.setup()

    await renderPage({ financeiro: ['write'] })
    const card = await screen.findByTestId('day-use-card-court-1')
    const priceInput = within(card).getByLabelText('Preço')

    await user.clear(priceInput)
    await user.type(priceInput, '60')
    await user.tab()

    await waitFor(() => expect(patchSpy).toHaveBeenCalledWith('court-1', { price: 60 }))
  })

  it('clicar num pill de dia dispara PATCH com availableDays atualizado (sem mexer em enabled)', async () => {
    vi.spyOn(dayUseApi, 'listDayUseConfigs').mockResolvedValue({
      ok: true,
      configs: [makeConfig({ enabled: true, availableDays: [1, 2] })],
    })
    const patchSpy = vi.spyOn(dayUseApi, 'patchDayUseConfig').mockResolvedValue({
      ok: true,
      config: makeConfig({ enabled: true, availableDays: [1, 2, 3] }),
    })
    const user = userEvent.setup()

    await renderPage({ financeiro: ['write'] })
    const card = await screen.findByTestId('day-use-card-court-1')

    await user.click(within(card).getByText('Qua'))

    await waitFor(() =>
      expect(patchSpy).toHaveBeenCalledWith('court-1', { availableDays: [1, 2, 3] }),
    )
  })

  it('mostra um alerta no card quando o PATCH falha', async () => {
    vi.spyOn(dayUseApi, 'listDayUseConfigs').mockResolvedValue({
      ok: true,
      configs: [makeConfig({ enabled: false })],
    })
    vi.spyOn(dayUseApi, 'patchDayUseConfig').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'internal_error',
    })
    const user = userEvent.setup()

    await renderPage({ financeiro: ['write'] })
    const card = await screen.findByTestId('day-use-card-court-1')

    await user.click(within(card).getByLabelText(/ativar day use em quadra 1/i))

    expect(await within(card).findByRole('alert')).toHaveTextContent(/não foi possível salvar/i)
  })
})
