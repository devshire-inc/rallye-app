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
import * as dayUseApi from '../../lib/api/dayUse'
import * as dayUseBookingsApi from '../../lib/api/dayUseBookings'
import type { DayUseBookingItem, OccupancySummary } from '../../lib/api/dayUseBookings'
import DayUseBookingsPage from './DayUseBookingsPage'
import DayUseConfigPage from './DayUseConfigPage'

function makeItem(overrides: Partial<DayUseBookingItem> = {}): DayUseBookingItem {
  return {
    bookingId: 'booking-1',
    studentName: 'Marina Costa',
    startTime: '08:00',
    endTime: '18:00',
    sport: 'beach_tennis',
    amount: 45,
    checkedIn: false,
    checkedInAt: null,
    status: 'Aguardando check-in',
    ...overrides,
  }
}

function makeSummary(overrides: Partial<OccupancySummary> = {}): OccupancySummary {
  return {
    confirmedToday: 2,
    slotsTotal: 12,
    amountToday: 105,
    ...overrides,
  }
}

async function renderPage(permissions: Record<string, string[]>, unitId = 'unit-1') {
  fetchMePermissionsMock.mockResolvedValue({ kind: 'full', permissions })

  const utils = render(
    <PermissionsProvider>
      <MemoryRouter initialEntries={[`/units/${unitId}/day-use/reservas`]}>
        <Routes>
          <Route path="/units/:unitId/day-use" element={<DayUseConfigPage />} />
          <Route path="/units/:unitId/day-use/reservas" element={<DayUseBookingsPage />} />
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

describe('DayUseBookingsPage — sem financeiro:read e sem quadras:read', () => {
  beforeEach(() => {
    fetchMePermissionsMock.mockReset()
  })

  it('esconde tabs/lista/barra de total e não busca reservas — esconder sempre', async () => {
    const listSpy = vi.spyOn(dayUseBookingsApi, 'listDayUseBookings')

    await renderPage({ financeiro: [], quadras: [] })

    expect(screen.getByText('Reservas de Day Use')).toBeInTheDocument() // chrome sempre visível
    expect(screen.queryByRole('group', { name: /filtrar por período/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/ocupação de hoje/i)).not.toBeInTheDocument()
    expect(listSpy).not.toHaveBeenCalled()
  })
})

describe('DayUseBookingsPage — OR de permissão de leitura (financeiro OU quadras)', () => {
  beforeEach(() => {
    fetchMePermissionsMock.mockReset()
  })

  it('financeiro:read sozinho já mostra a tela', async () => {
    vi.spyOn(dayUseBookingsApi, 'listDayUseBookings').mockResolvedValue({
      ok: true,
      bookings: [],
      summary: makeSummary(),
    })

    await renderPage({ financeiro: ['read'] })

    expect(await screen.findByText(/ocupação de hoje/i)).toBeInTheDocument()
  })

  it('quadras:read sozinho já mostra a tela', async () => {
    vi.spyOn(dayUseBookingsApi, 'listDayUseBookings').mockResolvedValue({
      ok: true,
      bookings: [],
      summary: makeSummary(),
    })

    await renderPage({ quadras: ['read'] })

    expect(await screen.findByText(/ocupação de hoje/i)).toBeInTheDocument()
  })
})

describe('DayUseBookingsPage — loading e erro', () => {
  beforeEach(() => {
    fetchMePermissionsMock.mockReset()
  })

  it('mostra status de carregamento enquanto o GET está pendente', async () => {
    vi.spyOn(dayUseBookingsApi, 'listDayUseBookings').mockReturnValue(new Promise(() => {}))

    await renderPage({ financeiro: ['read'] })

    expect(screen.getByText(/carregando reservas/i)).toBeInTheDocument()
  })

  it('mostra um alerta quando o GET falha', async () => {
    vi.spyOn(dayUseBookingsApi, 'listDayUseBookings').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'internal_error',
    })

    await renderPage({ financeiro: ['read'] })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /não foi possível carregar as reservas/i,
    )
  })
})

describe('DayUseBookingsPage — listagem centralizada, tabs e resumo', () => {
  beforeEach(() => {
    fetchMePermissionsMock.mockReset()
  })

  it('lista reservas de quadras diferentes juntas, com nome/horário/esporte/valor/badge', async () => {
    vi.spyOn(dayUseBookingsApi, 'listDayUseBookings').mockResolvedValue({
      ok: true,
      bookings: [
        makeItem({
          bookingId: 'b-a',
          studentName: 'Marina Costa',
          sport: 'beach_tennis',
          checkedIn: true,
          checkedInAt: '2026-07-22T11:14:00Z',
          status: 'Check-in feito · 08:14',
        }),
        makeItem({
          bookingId: 'b-b',
          studentName: 'Rafael Nunes',
          sport: 'padel',
          amount: 60,
          checkedIn: false,
          status: 'Aguardando check-in',
        }),
      ],
      summary: makeSummary(),
    })

    await renderPage({ financeiro: ['read', 'write'] })

    const rowA = await screen.findByTestId('booking-row-b-a')
    expect(rowA).toHaveTextContent('Marina Costa')
    expect(rowA).toHaveTextContent('08:00–18:00')
    expect(rowA).toHaveTextContent('Beach tennis')
    expect(rowA).toHaveTextContent('R$ 45,00')
    expect(rowA).toHaveTextContent('Check-in feito · 08:14')

    const rowB = screen.getByTestId('booking-row-b-b')
    expect(rowB).toHaveTextContent('Rafael Nunes')
    expect(rowB).toHaveTextContent('Padel')
    expect(rowB).toHaveTextContent('R$ 60,00')
    expect(rowB).toHaveTextContent('Aguardando check-in')
  })

  it('mostra a barra "Ocupação de hoje" com X de Y vagas e valor arrecadado', async () => {
    vi.spyOn(dayUseBookingsApi, 'listDayUseBookings').mockResolvedValue({
      ok: true,
      bookings: [],
      summary: makeSummary({ confirmedToday: 8, slotsTotal: 12, amountToday: 380 }),
    })

    await renderPage({ financeiro: ['read'] })

    expect(await screen.findByText(/ocupação de hoje/i)).toBeInTheDocument()
    expect(screen.getByText(/8 de 12 vagas/i)).toBeInTheDocument()
    expect(screen.getByText(/r\$\s*380,00 arrecadado/i)).toBeInTheDocument()
  })

  it('clicar numa aba troca o range pedido ao backend', async () => {
    const listSpy = vi.spyOn(dayUseBookingsApi, 'listDayUseBookings').mockResolvedValue({
      ok: true,
      bookings: [],
      summary: makeSummary(),
    })
    const user = userEvent.setup()

    await renderPage({ financeiro: ['read'] })
    await waitFor(() => expect(listSpy).toHaveBeenCalledWith('unit-1', 'today'))

    await user.click(screen.getByRole('button', { name: 'Esta semana' }))
    await waitFor(() => expect(listSpy).toHaveBeenCalledWith('unit-1', 'week'))

    await user.click(screen.getByRole('button', { name: 'Todas' }))
    await waitFor(() => expect(listSpy).toHaveBeenCalledWith('unit-1', 'all'))
  })

  it('botão voltar aponta para DU5', async () => {
    vi.spyOn(dayUseBookingsApi, 'listDayUseBookings').mockResolvedValue({
      ok: true,
      bookings: [],
      summary: makeSummary(),
    })

    await renderPage({ financeiro: ['read'] })

    expect(await screen.findByRole('link', { name: /config day use/i })).toHaveAttribute(
      'href',
      '/units/unit-1/day-use',
    )
  })
})

describe('DayUseBookingsPage — check-in manual (BEAC-1965)', () => {
  beforeEach(() => {
    fetchMePermissionsMock.mockReset()
  })

  it('com financeiro:write, tap numa reserva SEM check-in dispara o check-in manual e atualiza o badge', async () => {
    vi.spyOn(dayUseBookingsApi, 'listDayUseBookings').mockResolvedValue({
      ok: true,
      bookings: [makeItem({ bookingId: 'b-tap', checkedIn: false })],
      summary: makeSummary(),
    })
    const checkInSpy = vi.spyOn(dayUseBookingsApi, 'manualCheckIn').mockResolvedValue({
      ok: true,
      bookingId: 'b-tap',
      checkedInAt: '2026-07-22T11:14:00Z',
    })
    const user = userEvent.setup()

    await renderPage({ financeiro: ['read', 'write'] })
    const row = await screen.findByTestId('booking-row-b-tap')
    expect(row.tagName).toBe('BUTTON')

    await user.click(row)

    await waitFor(() => expect(checkInSpy).toHaveBeenCalledWith('b-tap'))
    await waitFor(() => expect(row).toHaveTextContent(/check-in feito/i))
  })

  it('sem financeiro:write, a linha SEM check-in não é tocável (esconder sempre)', async () => {
    vi.spyOn(dayUseBookingsApi, 'listDayUseBookings').mockResolvedValue({
      ok: true,
      bookings: [makeItem({ bookingId: 'b-no-write', checkedIn: false })],
      summary: makeSummary(),
    })
    const checkInSpy = vi.spyOn(dayUseBookingsApi, 'manualCheckIn')

    // financeiro:read (sem write) já basta pra VER a lista (OR do AC), mas
    // não pra tocar/confirmar o check-in.
    await renderPage({ financeiro: ['read'] })
    const row = await screen.findByTestId('booking-row-b-no-write')

    expect(row.tagName).toBe('DIV')
    expect(checkInSpy).not.toHaveBeenCalled()
  })

  it('uma reserva JÁ com check-in nunca é tocável, mesmo com financeiro:write', async () => {
    vi.spyOn(dayUseBookingsApi, 'listDayUseBookings').mockResolvedValue({
      ok: true,
      bookings: [
        makeItem({ bookingId: 'b-done', checkedIn: true, status: 'Check-in feito · 08:14' }),
      ],
      summary: makeSummary(),
    })

    await renderPage({ financeiro: ['read', 'write'] })
    const row = await screen.findByTestId('booking-row-b-done')

    expect(row.tagName).toBe('DIV')
  })

  it('mostra um alerta na linha quando o check-in manual falha', async () => {
    vi.spyOn(dayUseBookingsApi, 'listDayUseBookings').mockResolvedValue({
      ok: true,
      bookings: [makeItem({ bookingId: 'b-fail', checkedIn: false })],
      summary: makeSummary(),
    })
    vi.spyOn(dayUseBookingsApi, 'manualCheckIn').mockResolvedValue({
      ok: false,
      status: 409,
      error: 'already_checked_in',
    })
    const user = userEvent.setup()

    await renderPage({ financeiro: ['read', 'write'] })
    const row = await screen.findByTestId('booking-row-b-fail')

    await user.click(row)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /não foi possível confirmar o check-in/i,
    )
  })
})

describe('DayUseConfigPage (DU5) — link "Ver reservas" chega em DU6 de verdade', () => {
  beforeEach(() => {
    fetchMePermissionsMock.mockReset()
  })

  it('clicar em "Ver reservas" navega para a tela DU6 real (não mais o catch-all)', async () => {
    vi.spyOn(dayUseApi, 'listDayUseConfigs').mockResolvedValue({
      ok: true,
      configs: [],
    })
    vi.spyOn(dayUseBookingsApi, 'listDayUseBookings').mockResolvedValue({
      ok: true,
      bookings: [],
      summary: makeSummary(),
    })
    const user = userEvent.setup()

    fetchMePermissionsMock.mockResolvedValue({
      kind: 'full',
      permissions: { financeiro: ['write', 'read'] },
    })
    render(
      <PermissionsProvider>
        <MemoryRouter initialEntries={['/units/unit-1/day-use']}>
          <Routes>
            <Route path="/units/:unitId/day-use" element={<DayUseConfigPage />} />
            <Route path="/units/:unitId/day-use/reservas" element={<DayUseBookingsPage />} />
          </Routes>
        </MemoryRouter>
      </PermissionsProvider>,
    )
    act(() => {
      window.dispatchEvent(new Event(SESSION_ESTABLISHED_EVENT))
    })
    await waitFor(() => expect(fetchMePermissionsMock).toHaveBeenCalled())

    await user.click(await screen.findByRole('button', { name: /ver reservas/i }))

    expect(await screen.findByText('Reservas de Day Use')).toBeInTheDocument()
  })
})
