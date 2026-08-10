import { screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as bookingsApi from '../../lib/api/bookings'
import * as courtsApi from '../../lib/api/courts'
import { renderWithPermissions } from '../../test/renderWithPermissions'
import AG2WeekPage from './AG2WeekPage'

afterEach(() => {
  vi.restoreAllMocks()
})

const courts: courtsApi.Court[] = [
  { id: 'court-1', unitId: 'unit-1', name: 'Q1', sport: 'beach_tennis', status: 'active' },
  { id: 'court-2', unitId: 'unit-1', name: 'Q2', sport: 'beach_tennis', status: 'active' },
]

function renderPage() {
  return renderWithPermissions(
    <MemoryRouter initialEntries={['/units/unit-1/agenda/semana']}>
      <Routes>
        <Route path="/units/:unitId/agenda" element={<div>AG1 placeholder</div>} />
        <Route path="/units/:unitId/agenda/semana" element={<AG2WeekPage />} />
        <Route path="/units/:unitId/bookings/:bookingId" element={<div>AG5 placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AG2WeekPage', () => {
  it('shows only 1 quadra (dropdown) and the 7 weekdays as columns', async () => {
    vi.spyOn(courtsApi, 'listCourts').mockResolvedValue({ ok: true, courts })
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, bookings: [], viewOnly: false })

    renderPage()

    expect(await screen.findByLabelText('Quadra')).toBeInTheDocument()
    for (const day of ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']) {
      expect(screen.getByText(day)).toBeInTheDocument()
    }
  })

  it('renders the week stats footer with occupancy/free slots and a placeholder for revenue', async () => {
    vi.spyOn(courtsApi, 'listCourts').mockResolvedValue({ ok: true, courts })
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, bookings: [], viewOnly: false })

    renderPage()
    await waitFor(() => expect(bookingsApi.getBookingsGrid).toHaveBeenCalled())

    expect(screen.getByText(/Ocupação da semana:/)).toBeInTheDocument()
    expect(screen.getByText(/Horários livres:/)).toBeInTheDocument()
    expect(screen.getByText(/Receita da quadra:/)).toBeInTheDocument()
    expect(screen.getByText('indisponível')).toBeInTheDocument()
  })

  /* A barreira deste teste é a RESPOSTA aplicada, não a chamada disparada.
   * `getBookingsGrid` ter sido chamada e `setViewOnly(true)` ter sido aplicado
   * são dois momentos diferentes — a chamada acontece no corpo de
   * `reloadBookings`, o setState só no `.then`. Esperar pela chamada
   * (`toHaveBeenCalled()`) liberava a asserção enquanto `viewOnly` ainda era
   * `false`, e aí o FAB legitimamente existia:
   *
   *   expected document not to contain element, found
   *   <button aria-label="Nova reserva" class="fab">+</button>
   *
   * Passava quase sempre porque o `waitFor` só reavalia depois de um tick, e
   * até lá a microtask do `.then` normalmente já drenou — "quase sempre"
   * medido em 2 falhas a cada 30 execuções DO ARQUIVO SOZINHO, com a mesma
   * taxa em e77fe27 (não é regressão de nenhuma mudança recente; é a
   * sincronização errada desde sempre). */
  it('hides the FAB and disables empty slots when view_only=true', async () => {
    vi.spyOn(courtsApi, 'listCourts').mockResolvedValue({ ok: true, courts })
    vi.spyOn(bookingsApi, 'getBookingsGrid').mockResolvedValue({ ok: true, bookings: [], viewOnly: true })

    renderPage()

    // Barreira real: o FAB nasce presente (o estado inicial de `viewOnly` é
    // `false`) e só some quando a resposta chega — esperar por ele sumir não
    // é satisfeito de graça no primeiro tick.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Nova reserva' })).not.toBeInTheDocument(),
    )

    // "…and disables empty slots": a segunda metade do nome do teste, que
    // nunca chegou a ser verificada. Só é checável depois da barreira acima,
    // pelo mesmo motivo.
    const freeSlots = screen.getAllByRole('button', { name: /Horário livre/ })
    expect(freeSlots.length).toBeGreaterThan(0)
    for (const slot of freeSlots) {
      expect(slot).toHaveAttribute('aria-disabled', 'true')
      expect(slot).toHaveAttribute('tabindex', '-1')
    }
  })
})
