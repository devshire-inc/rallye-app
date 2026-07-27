import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as dayUseFlowApi from '../../lib/api/dayUseFlow'
import type { DayUseDetail } from '../../lib/api/dayUseFlow'
import { renderWithPermissions } from '../../test/renderWithPermissions'
import DayUseConfirmPage from './DayUseConfirmPage'

afterEach(() => {
  vi.restoreAllMocks()
})

function detail(overrides: Partial<DayUseDetail> = {}): DayUseDetail {
  return {
    unitId: 'unit-1',
    name: 'Sunset Beach Club',
    address: 'Av. Atlântica, 1200 - Copa',
    city: 'Rio de Janeiro',
    state: 'RJ',
    photos: [],
    rating: null,
    courtsSummary: '4 quadra(s) de beach_tennis',
    dayUse: {
      price: 60,
      startTime: '08:00',
      endTime: '18:00',
      sports: ['beach_tennis'],
      slotsTotal: 10,
      slotsLeft: 3,
      lotado: false,
    },
    ...overrides,
  }
}

function renderPage(
  initialEntry: { pathname: string; state: { date: string } | null } = {
    pathname: '/day-use/unit-1/confirm',
    state: { date: '2026-08-01' },
  },
) {
  return renderWithPermissions(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/day-use/:unitId/confirm" element={<DayUseConfirmPage />} />
        <Route path="/day-use-bookings/:bookingId" element={<div>QR placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('DayUseConfirmPage — loading, error, not-found, unavailable', () => {
  it('shows a loading status while the summary is being fetched', () => {
    vi.spyOn(dayUseFlowApi, 'getDayUseDetail').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error message when the fetch fails', async () => {
    vi.spyOn(dayUseFlowApi, 'getDayUseDetail').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'day_use_detail_failed',
    })

    renderPage()

    expect(
      await screen.findByText('Não foi possível carregar o resumo desta reserva.'),
    ).toBeInTheDocument()
  })

  it('shows a not-found message on 404', async () => {
    vi.spyOn(dayUseFlowApi, 'getDayUseDetail').mockResolvedValue({
      ok: false,
      status: 404,
      error: 'unit_not_found',
    })

    renderPage()

    expect(await screen.findByText('Arena não encontrada.')).toBeInTheDocument()
  })

  it('shows an unavailable message when Day Use is null for the date', async () => {
    vi.spyOn(dayUseFlowApi, 'getDayUseDetail').mockResolvedValue({
      ok: true,
      detail: detail({ dayUse: null }),
    })

    renderPage()

    expect(
      await screen.findByText('Day Use não está mais disponível para esta data.'),
    ).toBeInTheDocument()
  })
})

describe('DayUseConfirmPage — ready state', () => {
  it('renders arena/reservation/payment summary and the CTA with the total price', async () => {
    vi.spyOn(dayUseFlowApi, 'getDayUseDetail').mockResolvedValue({ ok: true, detail: detail() })

    renderPage()

    expect(await screen.findByText('Sunset Beach Club')).toBeInTheDocument()
    expect(screen.getByText('01/08/2026')).toBeInTheDocument()
    expect(screen.getByText('08:00 - 18:00')).toBeInTheDocument()
    expect(screen.getByText('Beach tennis')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CONFIRMAR E PAGAR — R$ 60,00' })).toBeInTheDocument()
  })

  it('defaults the date to today when no router state is provided', async () => {
    const spy = vi
      .spyOn(dayUseFlowApi, 'getDayUseDetail')
      .mockResolvedValue({ ok: true, detail: detail() })

    renderPage({ pathname: '/day-use/unit-1/confirm', state: null })

    await screen.findByText('Sunset Beach Club')
    expect(spy).toHaveBeenCalledWith('unit-1', dayUseFlowApi.todayIsoDate())
  })

  it('navigates to DU4 when the booking succeeds', async () => {
    const user = userEvent.setup()
    vi.spyOn(dayUseFlowApi, 'getDayUseDetail').mockResolvedValue({ ok: true, detail: detail() })
    vi.spyOn(dayUseFlowApi, 'bookDayUse').mockResolvedValue({
      ok: true,
      booking: {
        id: 'booking-1',
        unitId: 'unit-1',
        courtId: 'court-1',
        sport: 'beach_tennis',
        date: '2026-08-01',
        startTime: '08:00',
        endTime: '18:00',
        price: 60,
        invoiceId: 'invoice-1',
      },
    })

    renderPage()

    await user.click(await screen.findByRole('button', { name: 'CONFIRMAR E PAGAR — R$ 60,00' }))

    expect(await screen.findByText('QR placeholder')).toBeInTheDocument()
    expect(dayUseFlowApi.bookDayUse).toHaveBeenCalledWith('unit-1', '2026-08-01')
  })

  it('shows the slot-taken panel when the booking is rejected with a conflict', async () => {
    const user = userEvent.setup()
    vi.spyOn(dayUseFlowApi, 'getDayUseDetail').mockResolvedValue({ ok: true, detail: detail() })
    vi.spyOn(dayUseFlowApi, 'bookDayUse').mockResolvedValue({ ok: false, slotTaken: true })

    renderPage()

    await user.click(await screen.findByRole('button', { name: 'CONFIRMAR E PAGAR — R$ 60,00' }))

    expect(await screen.findByText('Ops! Última vaga foi preenchida.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '‹ Voltar' })).toBeInTheDocument()
  })

  it('shows a generic error message when the booking fails for another reason', async () => {
    const user = userEvent.setup()
    vi.spyOn(dayUseFlowApi, 'getDayUseDetail').mockResolvedValue({ ok: true, detail: detail() })
    vi.spyOn(dayUseFlowApi, 'bookDayUse').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'day_use_book_failed',
    })

    renderPage()

    await user.click(await screen.findByRole('button', { name: 'CONFIRMAR E PAGAR — R$ 60,00' }))

    expect(
      await screen.findByText('Não foi possível confirmar a reserva. Tente novamente.'),
    ).toBeInTheDocument()
  })
})
