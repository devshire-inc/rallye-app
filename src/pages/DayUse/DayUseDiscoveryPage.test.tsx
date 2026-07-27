import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as dayUseFlowApi from '../../lib/api/dayUseFlow'
import type { ArenaSummary } from '../../lib/api/dayUseFlow'
import { renderWithPermissions } from '../../test/renderWithPermissions'
import DayUseDiscoveryPage from './DayUseDiscoveryPage'

afterEach(() => {
  vi.restoreAllMocks()
})

function arena(overrides: Partial<ArenaSummary> = {}): ArenaSummary {
  return {
    unitId: 'unit-1',
    name: 'Sunset Beach Club',
    address: 'Av. Atlântica, 1200 - Copa',
    sports: ['beach_tennis', 'futevolei'],
    price: 60,
    slotsLeft: 8,
    lotado: false,
    ...overrides,
  }
}

function renderPage() {
  return renderWithPermissions(
    <MemoryRouter initialEntries={['/day-use']}>
      <Routes>
        <Route path="/day-use" element={<DayUseDiscoveryPage />} />
        <Route path="/day-use/:unitId" element={<div>Detalhe da arena placeholder</div>} />
        <Route path="/day-use/:unitId/confirm" element={<div>Confirmar placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('DayUseDiscoveryPage — loading and error', () => {
  it('shows a loading status while arenas are being fetched', () => {
    vi.spyOn(dayUseFlowApi, 'discoverDayUse').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error message when the fetch fails', async () => {
    vi.spyOn(dayUseFlowApi, 'discoverDayUse').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'discover_failed',
    })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar as arenas com Day Use.',
    )
  })

  it('shows an empty state when there are no arenas', async () => {
    vi.spyOn(dayUseFlowApi, 'discoverDayUse').mockResolvedValue({ ok: true, arenas: [] })

    renderPage()

    expect(await screen.findByText('Nenhuma arena com Day Use na sua região.')).toBeInTheDocument()
  })
})

describe('DayUseDiscoveryPage — list and actions', () => {
  it('renders arena cards with name, address, price and a RESERVAR button', async () => {
    vi.spyOn(dayUseFlowApi, 'discoverDayUse').mockResolvedValue({
      ok: true,
      arenas: [arena()],
    })

    renderPage()

    expect(await screen.findByTestId('arena-card-unit-1')).toBeInTheDocument()
    expect(screen.getByText('Sunset Beach Club')).toBeInTheDocument()
    expect(screen.getByText('Av. Atlântica, 1200 - Copa')).toBeInTheDocument()
    expect(screen.getByText('R$ 60,00')).toBeInTheDocument()
    expect(screen.getByTestId('reservar-unit-1')).toBeInTheDocument()
  })

  it('renders a lotado arena without a RESERVAR button', async () => {
    vi.spyOn(dayUseFlowApi, 'discoverDayUse').mockResolvedValue({
      ok: true,
      arenas: [arena({ lotado: true })],
    })

    renderPage()

    expect(await screen.findByText('LOTADO')).toBeInTheDocument()
    expect(screen.queryByTestId('reservar-unit-1')).not.toBeInTheDocument()
  })

  it('navigates to DU2 when tapping the arena card', async () => {
    const user = userEvent.setup()
    vi.spyOn(dayUseFlowApi, 'discoverDayUse').mockResolvedValue({
      ok: true,
      arenas: [arena()],
    })

    renderPage()

    const card = await screen.findByTestId('arena-card-unit-1')
    await user.click(card.querySelector('.du-arena-main') as HTMLElement)

    expect(await screen.findByText('Detalhe da arena placeholder')).toBeInTheDocument()
  })

  it('navigates straight to DU3 when tapping RESERVAR', async () => {
    const user = userEvent.setup()
    vi.spyOn(dayUseFlowApi, 'discoverDayUse').mockResolvedValue({
      ok: true,
      arenas: [arena()],
    })

    renderPage()

    await user.click(await screen.findByTestId('reservar-unit-1'))

    expect(await screen.findByText('Confirmar placeholder')).toBeInTheDocument()
  })

  it('re-fetches when the sport filter pill changes', async () => {
    const discoverSpy = vi
      .spyOn(dayUseFlowApi, 'discoverDayUse')
      .mockResolvedValue({ ok: true, arenas: [arena()] })
    const user = userEvent.setup()

    renderPage()
    await screen.findByTestId('arena-card-unit-1')

    await user.click(screen.getByRole('button', { name: 'Padel' }))

    await waitFor(() => {
      expect(discoverSpy).toHaveBeenLastCalledWith(expect.objectContaining({ sport: 'padel' }))
    })
  })

  it('re-fetches when the search field changes', async () => {
    const discoverSpy = vi
      .spyOn(dayUseFlowApi, 'discoverDayUse')
      .mockResolvedValue({ ok: true, arenas: [arena()] })
    const user = userEvent.setup()

    renderPage()
    await screen.findByTestId('arena-card-unit-1')

    await user.type(screen.getByLabelText('Buscar arena por nome ou cidade'), 'Copa')

    await waitFor(() => {
      expect(discoverSpy).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Copa' }))
    })
  })
})
