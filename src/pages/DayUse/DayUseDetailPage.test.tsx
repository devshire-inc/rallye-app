import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as dayUseFlowApi from '../../lib/api/dayUseFlow'
import type { DayUseDetail } from '../../lib/api/dayUseFlow'
import DayUseDetailPage from './DayUseDetailPage'

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
    courtsSummary: '4 quadra(s) de beach_tennis + 2 quadra(s) de futevolei',
    dayUse: {
      price: 60,
      startTime: '06:00',
      endTime: '22:00',
      sports: ['beach_tennis', 'futevolei'],
      slotsTotal: 20,
      slotsLeft: 12,
      lotado: false,
    },
    ...overrides,
  }
}

function renderPage(unitId = 'unit-1') {
  return render(
    <MemoryRouter initialEntries={[`/day-use/${unitId}`]}>
      <Routes>
        <Route path="/day-use/:unitId" element={<DayUseDetailPage />} />
        <Route path="/day-use/:unitId/confirm" element={<div>Confirmar placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('DayUseDetailPage — loading, error, not found', () => {
  it('shows a loading status while the detail is being fetched', () => {
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
      await screen.findByText('Não foi possível carregar os detalhes desta arena.'),
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
})

describe('DayUseDetailPage — ready state', () => {
  it('renders arena facts, day use card and an enabled CTA', async () => {
    vi.spyOn(dayUseFlowApi, 'getDayUseDetail').mockResolvedValue({ ok: true, detail: detail() })

    renderPage()

    expect(await screen.findByText('R$ 60,00 /dia')).toBeInTheDocument()
    expect(screen.getByText('Horário: 06:00 - 22:00')).toBeInTheDocument()
    expect(screen.getByText('Vagas: 8 de 20')).toBeInTheDocument()
    const cta = screen.getByRole('button', { name: 'RESERVAR DAY USE — R$ 60,00' })
    expect(cta).toBeEnabled()
  })

  it('disables the CTA and shows LOTADO when the arena has no slots left', async () => {
    vi.spyOn(dayUseFlowApi, 'getDayUseDetail').mockResolvedValue({
      ok: true,
      detail: detail({ dayUse: { ...detail().dayUse!, slotsLeft: 0, lotado: true } }),
    })

    renderPage()

    const cta = await screen.findByRole('button', { name: 'LOTADO' })
    expect(cta).toBeDisabled()
  })

  it('shows a message and no CTA action when Day Use is unavailable for the date', async () => {
    vi.spyOn(dayUseFlowApi, 'getDayUseDetail').mockResolvedValue({
      ok: true,
      detail: detail({ dayUse: null }),
    })

    renderPage()

    expect(await screen.findByText('Day Use não disponível para esta data.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'LOTADO' })).toBeDisabled()
  })

  it('navigates to DU3 when tapping the CTA', async () => {
    const user = userEvent.setup()
    vi.spyOn(dayUseFlowApi, 'getDayUseDetail').mockResolvedValue({ ok: true, detail: detail() })

    renderPage()

    await user.click(await screen.findByRole('button', { name: 'RESERVAR DAY USE — R$ 60,00' }))

    expect(await screen.findByText('Confirmar placeholder')).toBeInTheDocument()
  })
})
