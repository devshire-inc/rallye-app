import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as plansApi from '../../lib/api/plans'
import type { PlanDetail } from '../../lib/api/plans'
import PlanoFormPage from './PlanoFormPage'

afterEach(() => {
  vi.restoreAllMocks()
})

function renderCreatePage(unitId = 'unit-1') {
  return render(
    <MemoryRouter initialEntries={[`/units/${unitId}/plans/new`]}>
      <Routes>
        <Route path="/units/:unitId/plans/new" element={<PlanoFormPage />} />
        <Route path="/units/:unitId/plans" element={<div>Catálogo de planos placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderEditPage(unitId = 'unit-1', planId = 'plan-1') {
  return render(
    <MemoryRouter initialEntries={[`/units/${unitId}/plans/${planId}`]}>
      <Routes>
        <Route path="/units/:unitId/plans/:planId" element={<PlanoFormPage />} />
        <Route path="/units/:unitId/plans" element={<div>Catálogo de planos placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function existingPlan(overrides: Partial<PlanDetail> = {}): PlanDetail {
  return {
    id: 'plan-1',
    unitId: 'unit-1',
    name: '3x por semana - Beach Tennis',
    type: 'mensalidade',
    sport: 'beach_tennis',
    maxMembers: 1,
    description: null,
    isActive: true,
    variants: [
      {
        id: 'variant-1',
        planId: 'plan-1',
        billingCycle: 'mensal',
        basePrice: 350,
        discountPercent: 0,
        finalPrice: 350,
        sessionsPerWeek: 3,
        totalSessions: null,
        isActive: true,
      },
      {
        id: 'variant-2',
        planId: 'plan-1',
        billingCycle: 'trimestral',
        basePrice: 350,
        discountPercent: 10,
        finalPrice: 315,
        sessionsPerWeek: 3,
        totalSessions: null,
        isActive: true,
      },
    ],
    ...overrides,
  }
}

describe('PlanoFormPage — modo criação', () => {
  it('renders the type pills and generates the 5 default recurrence variants for mensalidade', () => {
    renderCreatePage()

    expect(screen.getByRole('button', { name: 'Mensalidade' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByLabelText('Ativar Mensal')).toBeInTheDocument()
    expect(screen.getByLabelText('Ativar Bimestral')).toBeInTheDocument()
    expect(screen.getByLabelText('Ativar Trimestral')).toBeInTheDocument()
    expect(screen.getByLabelText('Ativar Semestral')).toBeInTheDocument()
    expect(screen.getByLabelText('Ativar Anual')).toBeInTheDocument()
  })

  it('recomputes the displayed final price/discount live from base price and per-variant discount (PL2 example: trimestral R$170,91/mês -10%)', async () => {
    renderCreatePage()

    await userEvent.type(screen.getByLabelText('Preço base'), '189.90')

    // 189.90 * (1 - 10/100) = 170.91 (mesmo exemplo do AC de BEAC-1935).
    expect(screen.getByText('R$ 170,91/mês · −10%')).toBeInTheDocument()
  })

  it('hides the recurrence variants section for pacote/day_use (preço único, sem recorrência — PL2 regra 4)', async () => {
    renderCreatePage()

    await userEvent.click(screen.getByRole('button', { name: 'Pacote' }))

    expect(screen.queryByLabelText('Ativar Mensal')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Total de sessões')).toBeInTheDocument()
  })

  it('calls createPlan (BEAC-1931) with the form data on submit and navigates back to PL1', async () => {
    vi.spyOn(plansApi, 'createPlan').mockResolvedValue({ ok: true, plan: existingPlan() })

    renderCreatePage()

    await userEvent.type(screen.getByLabelText('Nome'), '3x por semana - Beach Tennis')
    await userEvent.type(screen.getByLabelText('Preço base'), '350')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar plano' }))

    expect(await screen.findByText('Catálogo de planos placeholder')).toBeInTheDocument()
    expect(plansApi.createPlan).toHaveBeenCalledWith(
      'unit-1',
      expect.objectContaining({ name: '3x por semana - Beach Tennis', type: 'mensalidade' }),
    )
  })

  it('shows the exact foot-note required by the AC', () => {
    renderCreatePage()

    expect(
      screen.getByText('Editar não afeta assinaturas existentes — só novas.'),
    ).toBeInTheDocument()
  })
})

describe('PlanoFormPage — modo edição', () => {
  it('hydrates the form from getPlanForEdit (PATCH /plans/{id} com corpo vazio)', async () => {
    vi.spyOn(plansApi, 'getPlanForEdit').mockResolvedValue({ ok: true, plan: existingPlan() })

    renderEditPage()

    expect(await screen.findByDisplayValue('3x por semana - Beach Tennis')).toBeInTheDocument()
    expect(plansApi.getPlanForEdit).toHaveBeenCalledWith('plan-1')
  })

  it('calls patchPlan (BEAC-1931) on submit, not createPlan', async () => {
    vi.spyOn(plansApi, 'getPlanForEdit').mockResolvedValue({ ok: true, plan: existingPlan() })
    const patchSpy = vi
      .spyOn(plansApi, 'patchPlan')
      .mockResolvedValue({ ok: true, plan: existingPlan() })
    const createSpy = vi.spyOn(plansApi, 'createPlan')

    renderEditPage()
    await screen.findByDisplayValue('3x por semana - Beach Tennis')

    await userEvent.click(screen.getByRole('button', { name: 'Salvar plano' }))

    expect(await screen.findByText('Catálogo de planos placeholder')).toBeInTheDocument()
    expect(patchSpy).toHaveBeenCalledWith(
      'plan-1',
      expect.objectContaining({ name: expect.any(String) }),
    )
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('shows an error state when the plan fails to load', async () => {
    vi.spyOn(plansApi, 'getPlanForEdit').mockResolvedValue({
      ok: false,
      status: 404,
      error: 'plan_not_found',
    })

    renderEditPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
  })
})
