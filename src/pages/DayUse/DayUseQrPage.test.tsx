import { render, screen } from '@testing-library/react'
import QRCode from 'qrcode'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import * as dayUseFlowApi from '../../lib/api/dayUseFlow'
import type { DayUseQr } from '../../lib/api/dayUseFlow'
import { toCalendarDateTime } from '../../lib/dayUseCalendar'
import DayUseQrPage from './DayUseQrPage'

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn() },
}))

afterEach(() => {
  vi.restoreAllMocks()
})

function qr(overrides: Partial<DayUseQr> = {}): DayUseQr {
  return {
    bookingId: 'booking-1',
    unitName: 'Sunset Beach Club',
    address: 'Av. Atlântica, 1200 - Copa',
    sport: 'beach_tennis',
    date: '2026-08-01',
    startTime: '08:00',
    endTime: '18:00',
    amountPaid: 60,
    token: 'signed-token-abc',
    checkedIn: false,
    checkedInAt: null,
    expired: false,
    ...overrides,
  }
}

function renderPage(bookingId = 'booking-1') {
  return render(
    <MemoryRouter initialEntries={[`/day-use-bookings/${bookingId}`]}>
      <Routes>
        <Route path="/day-use-bookings/:bookingId" element={<DayUseQrPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('DayUseQrPage — loading, error, not-found', () => {
  it('shows a loading status while the booking is being fetched', () => {
    vi.spyOn(dayUseFlowApi, 'getDayUseQr').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error message when the fetch fails', async () => {
    vi.spyOn(dayUseFlowApi, 'getDayUseQr').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'day_use_qr_failed',
    })

    renderPage()

    expect(await screen.findByText('Não foi possível carregar esta reserva.')).toBeInTheDocument()
  })

  it('shows a not-found message on 404', async () => {
    vi.spyOn(dayUseFlowApi, 'getDayUseQr').mockResolvedValue({
      ok: false,
      status: 404,
      error: 'booking_not_found',
    })

    renderPage()

    expect(await screen.findByText('Reserva não encontrada.')).toBeInTheDocument()
  })
})

describe('DayUseQrPage — ready state', () => {
  it('renders the confirmation, booking details and generates the QR image', async () => {
    vi.spyOn(dayUseFlowApi, 'getDayUseQr').mockResolvedValue({ ok: true, qr: qr() })
    const toDataURLMock = QRCode.toDataURL as unknown as Mock
    toDataURLMock.mockResolvedValue('data:image/png;base64,xxxx')

    renderPage()

    expect(await screen.findByText('Reserva Confirmada!')).toBeInTheDocument()
    expect(screen.getByText('Apresente na recepção')).toBeInTheDocument()
    expect(screen.getByText('Sunset Beach Club')).toBeInTheDocument()
    expect(screen.getByText('01/08/2026')).toBeInTheDocument()
    expect(screen.getByText('08:00 - 18:00')).toBeInTheDocument()
    expect(screen.getByText('Beach tennis')).toBeInTheDocument()
    expect(screen.getByText('R$ 60,00')).toBeInTheDocument()

    const img = await screen.findByRole('img')
    expect(img).toHaveAttribute('src', 'data:image/png;base64,xxxx')
    expect(QRCode.toDataURL).toHaveBeenCalledWith('signed-token-abc', expect.any(Object))

    const directions = screen.getByRole('link', { name: 'COMO CHEGAR' })
    expect(directions).toHaveAttribute('href', expect.stringContaining('google.com/maps/search'))
    const calendar = screen.getByRole('link', { name: 'ADICIONAR AO CALENDÁRIO' })
    expect(calendar).toHaveAttribute('href', expect.stringContaining('calendar.google.com'))
  })

  it('shows the expired state with a grayscale hint when the day has passed', async () => {
    vi.spyOn(dayUseFlowApi, 'getDayUseQr').mockResolvedValue({
      ok: true,
      qr: qr({ expired: true }),
    })
    const toDataURLMock = QRCode.toDataURL as unknown as Mock
    toDataURLMock.mockResolvedValue('data:image/png;base64,xxxx')

    renderPage()

    expect(await screen.findByText('Day Use expirado')).toBeInTheDocument()
    expect(screen.getByText('Este Day Use já venceu.')).toBeInTheDocument()
    const img = await screen.findByRole('img')
    expect(img.parentElement).toHaveClass('du4-qr-expired')
  })
})

describe('toCalendarDateTime', () => {
  it('formats an ISO date + HH:MM into the Google Calendar template format', () => {
    expect(toCalendarDateTime('2026-08-01', '08:00')).toBe('20260801T080000')
  })
})
