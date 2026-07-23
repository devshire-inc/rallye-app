import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as plansApi from '../../lib/api/plans'
import type { PlanSummary } from '../../lib/api/plans'
import * as usePermissionModule from '../../hooks/usePermission'
import PlanosListPage from './PlanosListPage'

afterEach(() => {
  vi.restoreAllMocks()
})

function mockPermissions(map: Record<string, boolean>) {
  vi.spyOn(usePermissionModule, 'usePermission').mockImplementation(
    (module: string, action: string) => map[`${module}:${action}`] ?? false,
  )
}

function plan(overrides: Partial<PlanSummary> = {}): PlanSummary {
  return {
    id: 'plan-1',
    name: '3x/semana',
    type: 'mensalidade',
    sport: 'beach_tennis',
    maxMembers: 1,
    isActive: true,
    variantCount: 6,
    activeSubscriberCount: 82,
    startingPrice: 280,
    ...overrides,
  }
}

function renderPage(unitId = 'unit-1') {
  return render(
    <MemoryRouter initialEntries={[`/units/${unitId}/plans`]}>
      <Routes>
        <Route path="/units/:unitId/plans" element={<PlanosListPage />} />
        <Route path="/units/:unitId/plans/new" element={<div>Novo plano placeholder</div>} />
        <Route path="/units/:unitId/plans/:planId" element={<div>Editar plano placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PlanosListPage — loading and error', () => {
  it('shows a loading status while plans are being fetched', () => {
    mockPermissions({ 'financeiro:write': true })
    vi.spyOn(plansApi, 'listPlans').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error message when the fetch fails', async () => {
    mockPermissions({ 'financeiro:write': true })
    vi.spyOn(plansApi, 'listPlans').mockResolvedValue({ ok: false, status: 500, error: 'x' })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
  })
})

describe('PlanosListPage — Admin vs no-permission', () => {
  it('shows "Novo plano" and "Vincular aluno" for a caller with financeiro:write', async () => {
    mockPermissions({ 'financeiro:write': true })
    vi.spyOn(plansApi, 'listPlans').mockResolvedValue({
      ok: true,
      groups: [{ sport: 'beach_tennis', plans: [plan()] }],
    })

    renderPage()

    await screen.findByText('3x/semana')
    expect(screen.getByRole('button', { name: /novo plano/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vincular aluno' })).toBeInTheDocument()
  })

  it('hides "Novo plano"/"Vincular aluno" without financeiro:write', async () => {
    mockPermissions({ 'financeiro:write': false })
    vi.spyOn(plansApi, 'listPlans').mockResolvedValue({
      ok: true,
      groups: [{ sport: 'beach_tennis', plans: [plan()] }],
    })

    renderPage()

    await screen.findByText('3x/semana')
    expect(screen.queryByRole('button', { name: /novo plano/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vincular aluno' })).not.toBeInTheDocument()
  })
})

describe('PlanosListPage — grouping and card content', () => {
  it('groups plans by sport and shows "N variantes · M assinantes" + "a partir de" price', async () => {
    mockPermissions({ 'financeiro:write': true })
    vi.spyOn(plansApi, 'listPlans').mockResolvedValue({
      ok: true,
      groups: [{ sport: 'beach_tennis', plans: [plan()] }],
    })

    renderPage()

    await screen.findByText('3x/semana')
    expect(screen.getByText('Beach tennis')).toBeInTheDocument()
    expect(screen.getByText('6 variantes · 82 assinantes')).toBeInTheDocument()
    expect(screen.getByText('A partir de R$ 280,00/mês')).toBeInTheDocument()
  })

  it('shows "preço único" for pacote plans, in their own Pacotes section', async () => {
    mockPermissions({ 'financeiro:write': true })
    vi.spyOn(plansApi, 'listPlans').mockResolvedValue({
      ok: true,
      groups: [
        {
          sport: 'beach_tennis',
          plans: [
            plan({
              id: 'pacote-1',
              name: 'Pacote 10 aulas BT',
              type: 'pacote',
              startingPrice: 600,
            }),
          ],
        },
      ],
    })

    renderPage()

    await screen.findByText('Pacote 10 aulas BT')
    expect(screen.getByText('Pacotes')).toBeInTheDocument()
    expect(screen.queryByText('Beach tennis')).not.toBeInTheDocument()
    expect(screen.getByText('R$ 600,00 · preço único')).toBeInTheDocument()
  })

  it('puts family plans (max_members > 1) in their own Família section', async () => {
    mockPermissions({ 'financeiro:write': true })
    vi.spyOn(plansApi, 'listPlans').mockResolvedValue({
      ok: true,
      groups: [
        {
          sport: 'beach_tennis',
          plans: [plan({ id: 'familia-1', name: 'Família 3x/semana BT', maxMembers: 4 })],
        },
      ],
    })

    renderPage()

    await screen.findByText('Família 3x/semana BT')
    expect(screen.getByText('Família')).toBeInTheDocument()
    expect(screen.queryByText('Beach tennis')).not.toBeInTheDocument()
  })

  it('shows the "Inativo" badge and reduced-opacity class for an inactive plan', async () => {
    mockPermissions({ 'financeiro:write': true })
    vi.spyOn(plansApi, 'listPlans').mockResolvedValue({
      ok: true,
      groups: [{ sport: 'beach_tennis', plans: [plan({ isActive: false })] }],
    })

    renderPage()

    const card = await screen.findByTestId('plan-card-plan-1')
    expect(card.className).toContain('inactive')
    expect(screen.getByText('Inativo')).toBeInTheDocument()
  })
})

describe('PlanosListPage — navigation', () => {
  it('navigates to PL2 create mode when "Novo plano" is tapped', async () => {
    mockPermissions({ 'financeiro:write': true })
    vi.spyOn(plansApi, 'listPlans').mockResolvedValue({ ok: true, groups: [] })

    renderPage()
    await screen.findByText('Nenhum plano cadastrado.')

    await userEvent.click(screen.getByRole('button', { name: /novo plano/i }))

    expect(await screen.findByText('Novo plano placeholder')).toBeInTheDocument()
  })

  it('navigates to PL2 edit mode when a plan card is tapped', async () => {
    mockPermissions({ 'financeiro:write': true })
    vi.spyOn(plansApi, 'listPlans').mockResolvedValue({
      ok: true,
      groups: [{ sport: 'beach_tennis', plans: [plan()] }],
    })

    renderPage()
    await screen.findByText('3x/semana')

    await userEvent.click(screen.getByTestId('plan-card-plan-1'))

    expect(await screen.findByText('Editar plano placeholder')).toBeInTheDocument()
  })
})
