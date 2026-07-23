import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as meApi from '../../lib/api/me'
import * as plansApi from '../../lib/api/plans'
import type { PlanDetail, PlanGroupResult } from '../../lib/api/plans'
import * as subscriptionsApi from '../../lib/api/subscriptions'
import type { SubscriptionDetail } from '../../lib/api/subscriptions'
import PL5ChangePlanPage from './PL5ChangePlanPage'

afterEach(() => {
  vi.restoreAllMocks()
})

// Mesmo exemplo numérico da doc real (PL5, `scr-pl5`): 15 dias restantes de
// um período de 30 dias (01/01 - 30/01), 2x/semana R$250/mês (atual) ->
// 3x/semana R$350/mês (upgrade), diferença R$50.
function subscription(overrides: Partial<SubscriptionDetail> = {}): SubscriptionDetail {
  return {
    id: 'sub-1',
    studentId: 'student-1',
    plan: { id: 'plan-2x', name: '2x/semana Beach Tennis' },
    planVariant: { id: 'variant-2x-tri', billingCycle: 'trimestral', finalPrice: 250 },
    startDate: '2026-01-01',
    endDate: '2026-01-30',
    remainingDays: 15,
    status: 'active',
    autoRenew: true,
    creditBalance: 0,
    invoices: [],
    ...overrides,
  }
}

function planGroups(): PlanGroupResult[] {
  return [
    {
      sport: 'Beach Tennis',
      plans: [
        {
          id: 'plan-2x',
          name: '2x/semana Beach Tennis',
          type: 'mensalidade',
          sport: 'Beach Tennis',
          maxMembers: 1,
          isActive: true,
          variantCount: 1,
          activeSubscriberCount: 1,
          startingPrice: 250,
        },
        {
          id: 'plan-3x',
          name: '3x/semana Beach Tennis',
          type: 'mensalidade',
          sport: 'Beach Tennis',
          maxMembers: 1,
          isActive: true,
          variantCount: 1,
          activeSubscriberCount: 1,
          startingPrice: 350,
        },
        {
          id: 'plan-ilimitado',
          name: 'Ilimitado Beach Tennis',
          type: 'mensalidade',
          sport: 'Beach Tennis',
          maxMembers: 1,
          isActive: true,
          variantCount: 1,
          activeSubscriberCount: 1,
          startingPrice: 500,
        },
        {
          id: 'plan-mensal-only',
          name: 'Plano só mensal',
          type: 'mensalidade',
          sport: 'Beach Tennis',
          maxMembers: 1,
          isActive: true,
          variantCount: 1,
          activeSubscriberCount: 0,
          startingPrice: 100,
        },
      ],
    },
  ]
}

function planDetail(id: string, overrides: Partial<PlanDetail> = {}): PlanDetail {
  const base: Record<string, PlanDetail> = {
    'plan-2x': {
      id: 'plan-2x',
      unitId: 'unit-1',
      name: '2x/semana Beach Tennis',
      type: 'mensalidade',
      sport: 'Beach Tennis',
      maxMembers: 1,
      description: null,
      isActive: true,
      variants: [
        {
          id: 'variant-2x-tri',
          planId: 'plan-2x',
          billingCycle: 'trimestral',
          basePrice: 250,
          discountPercent: 0,
          finalPrice: 250,
          sessionsPerWeek: 2,
          totalSessions: null,
          isActive: true,
        },
      ],
    },
    'plan-3x': {
      id: 'plan-3x',
      unitId: 'unit-1',
      name: '3x/semana Beach Tennis',
      type: 'mensalidade',
      sport: 'Beach Tennis',
      maxMembers: 1,
      description: null,
      isActive: true,
      variants: [
        {
          id: 'variant-3x-tri',
          planId: 'plan-3x',
          billingCycle: 'trimestral',
          basePrice: 350,
          discountPercent: 0,
          finalPrice: 350,
          sessionsPerWeek: 3,
          totalSessions: null,
          isActive: true,
        },
      ],
    },
    'plan-ilimitado': {
      id: 'plan-ilimitado',
      unitId: 'unit-1',
      name: 'Ilimitado Beach Tennis',
      type: 'mensalidade',
      sport: 'Beach Tennis',
      maxMembers: 1,
      description: null,
      isActive: true,
      variants: [
        {
          id: 'variant-ilimitado-tri',
          planId: 'plan-ilimitado',
          billingCycle: 'trimestral',
          basePrice: 500,
          discountPercent: 0,
          finalPrice: 500,
          sessionsPerWeek: null,
          totalSessions: null,
          isActive: true,
        },
      ],
    },
    'plan-mensal-only': {
      id: 'plan-mensal-only',
      unitId: 'unit-1',
      name: 'Plano só mensal',
      type: 'mensalidade',
      sport: 'Beach Tennis',
      maxMembers: 1,
      description: null,
      isActive: true,
      // Nenhuma variante trimestral — não deve aparecer na lista do PL5
      // (recorrência restrita à do plano atual, AC #2).
      variants: [
        {
          id: 'variant-mensal-only-mensal',
          planId: 'plan-mensal-only',
          billingCycle: 'mensal',
          basePrice: 100,
          discountPercent: 0,
          finalPrice: 100,
          sessionsPerWeek: 1,
          totalSessions: null,
          isActive: true,
        },
      ],
    },
  }
  return { ...base[id], ...overrides }
}

function mockCatalog() {
  vi.spyOn(plansApi, 'listPlans').mockResolvedValue({ ok: true, groups: planGroups() })
  vi.spyOn(plansApi, 'getPlan').mockImplementation((planId: string) =>
    Promise.resolve({ ok: true, plan: planDetail(planId) }),
  )
}

function renderPage(unitId = 'unit-1') {
  return render(
    <MemoryRouter initialEntries={[`/units/${unitId}/my-subscription/change-plan`]}>
      <Routes>
        <Route path="/units/:unitId/my-subscription/change-plan" element={<PL5ChangePlanPage />} />
        <Route path="/units/:unitId/my-subscription" element={<div>PL4 placeholder</div>} />
        <Route path="/invoices/:invoiceId" element={<div>F3 placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PL5ChangePlanPage — loading and error', () => {
  it('shows a loading status while the subscription is being fetched', () => {
    vi.spyOn(meApi, 'getMe').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error message when the subscription fetch fails', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'student-1' })
    vi.spyOn(subscriptionsApi, 'getSubscription').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'x',
    })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
  })
})

describe('PL5ChangePlanPage — plano atual e lista de opções', () => {
  it('shows the header, "Plano atual" block and the selectable option list restricted to the same billing cycle', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'student-1' })
    vi.spyOn(subscriptionsApi, 'getSubscription').mockResolvedValue({
      ok: true,
      subscription: subscription(),
    })
    mockCatalog()

    renderPage()

    await screen.findByRole('heading', { name: 'Trocar Plano' })
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeInTheDocument()
    expect(screen.getByText('2x/semana Beach Tennis')).toBeInTheDocument()
    expect(screen.getByText('Trimestral · R$ 250,00/mês')).toBeInTheDocument()
    expect(screen.getByText('15 dias restantes')).toBeInTheDocument()

    // Opção atual: marcada "(atual)", não selecionável.
    const currentOption = screen.getByTestId('plan-option-variant-2x-tri')
    expect(currentOption).toHaveTextContent('(atual)')
    expect(within(currentOption).getByRole('radio')).toBeDisabled()

    // Upgrades disponíveis.
    const upgrade3x = screen.getByTestId('plan-option-variant-3x-tri')
    expect(upgrade3x).toHaveTextContent('3x/semana Beach Tennis')
    expect(upgrade3x).toHaveTextContent('R$ 350,00/mês')
    expect(upgrade3x).toHaveTextContent('↑ Upgrade')

    const upgradeIlimitado = screen.getByTestId('plan-option-variant-ilimitado-tri')
    expect(upgradeIlimitado).toHaveTextContent('↑ Upgrade')

    // Plano sem variante trimestral não aparece.
    expect(screen.queryByText('Plano só mensal')).not.toBeInTheDocument()
  })

  // BEAC-1976: PL5 chamava getPlanForEdit (PATCH /plans/{id} disfarçado de
  // GET), que exige financeiro:write — um Aluno real (a persona desta tela,
  // "Marina Costa · Aluna") nunca tem essa permission, então a tela sempre
  // devolvia 403 antes desta correção. Prova que o call site migrou pro
  // endpoint de leitura dedicado (getPlan, GET /plans/{id}), acessível a
  // qualquer membro.
  it('fetches per-plan variant detail via getPlan (GET /plans/{id}), not getPlanForEdit (BEAC-1976 — unblocks PL5 for a real student)', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'student-1' })
    vi.spyOn(subscriptionsApi, 'getSubscription').mockResolvedValue({
      ok: true,
      subscription: subscription(),
    })
    vi.spyOn(plansApi, 'listPlans').mockResolvedValue({ ok: true, groups: planGroups() })
    const getPlanSpy = vi
      .spyOn(plansApi, 'getPlan')
      .mockImplementation((planId: string) =>
        Promise.resolve({ ok: true, plan: planDetail(planId) }),
      )
    const getPlanForEditSpy = vi.spyOn(plansApi, 'getPlanForEdit')

    renderPage()

    await screen.findByTestId('plan-option-variant-3x-tri')

    expect(getPlanSpy).toHaveBeenCalledWith('plan-2x')
    expect(getPlanSpy).toHaveBeenCalledWith('plan-3x')
    expect(getPlanForEditSpy).not.toHaveBeenCalled()
  })
})

describe('PL5ChangePlanPage — cálculo dinâmico', () => {
  it('recalculates the upgrade pro-rata preview to match the doc example when a plan is selected (15/30 days, R$250→R$350, diff R$50)', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'student-1' })
    vi.spyOn(subscriptionsApi, 'getSubscription').mockResolvedValue({
      ok: true,
      subscription: subscription(),
    })
    mockCatalog()

    renderPage()
    await screen.findByTestId('plan-option-variant-3x-tri')

    await userEvent.click(
      within(screen.getByTestId('plan-option-variant-3x-tri')).getByRole('radio'),
    )

    expect(await screen.findByText('Crédito restante: R$ 125,00')).toBeInTheDocument()
    expect(screen.getByText('Novo valor (15d): R$ 175,00')).toBeInTheDocument()
    expect(screen.getByText('Diferença: R$ 50,00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CONFIRMAR TROCA — R$ 50,00' })).toBeInTheDocument()
  })

  // Regression guard (correction round 1, post-review): the old preview
  // rounded `creditRestante`/`novoValor` separately then subtracted the two
  // already-rounded values, which diverges from the backend's single-round
  // `prorate()` by 1 cent whenever remaining/total doesn't divide evenly.
  // 1/3 day-fraction reproduces the exact failure the Reviewer found by
  // hand: old logic would show R$ 33,34, backend/new logic gives R$ 33,33.
  it('matches the backend single-round formula exactly on a non-evenly-divisible period (1/3 days)', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'student-1' })
    vi.spyOn(subscriptionsApi, 'getSubscription').mockResolvedValue({
      ok: true,
      subscription: subscription({
        startDate: '2026-01-01',
        endDate: '2026-01-03',
        remainingDays: 1,
      }),
    })
    mockCatalog()

    renderPage()
    await screen.findByTestId('plan-option-variant-3x-tri')

    await userEvent.click(
      within(screen.getByTestId('plan-option-variant-3x-tri')).getByRole('radio'),
    )

    // round2((1/3) * (350 - 250)) = round2(33.333...) = 33.33 — matches
    // backend's prorate() exactly. The old double-rounded logic produced
    // R$ 33,34 here instead.
    expect(await screen.findByText('Diferença: R$ 33,33')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CONFIRMAR TROCA — R$ 33,33' })).toBeInTheDocument()
    expect(screen.queryByText('Diferença: R$ 33,34')).not.toBeInTheDocument()
  })

  it('shows the downgrade credit preview and the simple confirm label when a cheaper plan is selected', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'student-1' })
    vi.spyOn(subscriptionsApi, 'getSubscription').mockResolvedValue({
      ok: true,
      subscription: subscription({
        plan: { id: 'plan-3x', name: '3x/semana Beach Tennis' },
        planVariant: { id: 'variant-3x-tri', billingCycle: 'trimestral', finalPrice: 350 },
      }),
    })
    mockCatalog()

    renderPage()
    await screen.findByTestId('plan-option-variant-2x-tri')

    await userEvent.click(
      within(screen.getByTestId('plan-option-variant-2x-tri')).getByRole('radio'),
    )

    // (350-250) * 15/30 = 50 de crédito.
    expect(await screen.findByText('Crédito de R$ 50,00 aplicado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CONFIRMAR TROCA' })).toBeInTheDocument()
  })

  it('disables the confirm button until an option is selected', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'student-1' })
    vi.spyOn(subscriptionsApi, 'getSubscription').mockResolvedValue({
      ok: true,
      subscription: subscription(),
    })
    mockCatalog()

    renderPage()
    await screen.findByTestId('plan-option-variant-3x-tri')

    expect(screen.getByRole('button', { name: /CONFIRMAR TROCA/ })).toBeDisabled()
  })
})

describe('PL5ChangePlanPage — confirmar troca', () => {
  it('upgrade: calls change-plan and navigates to the invoice detail page (F3) on success', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'student-1' })
    vi.spyOn(subscriptionsApi, 'getSubscription').mockResolvedValue({
      ok: true,
      subscription: subscription(),
    })
    mockCatalog()
    const changePlanSpy = vi.spyOn(subscriptionsApi, 'changePlan').mockResolvedValue({
      ok: true,
      subscription: {
        id: 'sub-1',
        studentId: 'student-1',
        planVariantId: 'variant-3x-tri',
        startDate: '2026-01-01',
        endDate: '2026-01-30',
        status: 'active',
        paymentMethod: 'pix',
        autoRenew: true,
        creditBalance: 0,
      },
      proratedAmount: 50,
      invoice: {
        id: 'invoice-9',
        studentId: 'student-1',
        sourceType: 'subscription',
        sourceId: 'sub-1',
        description: 'Troca de plano — diferença pro-rata',
        amount: 50,
        dueDate: '2026-01-15',
        status: 'gerada',
      },
    })

    renderPage()
    await screen.findByTestId('plan-option-variant-3x-tri')
    await userEvent.click(
      within(screen.getByTestId('plan-option-variant-3x-tri')).getByRole('radio'),
    )

    await userEvent.click(screen.getByRole('button', { name: 'CONFIRMAR TROCA — R$ 50,00' }))

    expect(changePlanSpy).toHaveBeenCalledWith('sub-1', 'variant-3x-tri')
    expect(await screen.findByText('F3 placeholder')).toBeInTheDocument()
  })

  it('downgrade: calls change-plan, shows the credit confirmation, then navigates back to PL4', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'student-1' })
    vi.spyOn(subscriptionsApi, 'getSubscription').mockResolvedValue({
      ok: true,
      subscription: subscription({
        plan: { id: 'plan-3x', name: '3x/semana Beach Tennis' },
        planVariant: { id: 'variant-3x-tri', billingCycle: 'trimestral', finalPrice: 350 },
      }),
    })
    mockCatalog()
    vi.spyOn(subscriptionsApi, 'changePlan').mockResolvedValue({
      ok: true,
      subscription: {
        id: 'sub-1',
        studentId: 'student-1',
        planVariantId: 'variant-2x-tri',
        startDate: '2026-01-01',
        endDate: '2026-01-30',
        status: 'active',
        paymentMethod: 'pix',
        autoRenew: true,
        creditBalance: 50,
      },
      proratedAmount: -50,
      invoice: null,
    })

    renderPage()
    await screen.findByTestId('plan-option-variant-2x-tri')
    await userEvent.click(
      within(screen.getByTestId('plan-option-variant-2x-tri')).getByRole('radio'),
    )

    await userEvent.click(screen.getByRole('button', { name: 'CONFIRMAR TROCA' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Crédito de R$ 50,00 aplicado')).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: /voltar/i }))

    expect(await screen.findByText('PL4 placeholder')).toBeInTheDocument()
  })

  it('shows an inline error message when change-plan fails', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'student-1' })
    vi.spyOn(subscriptionsApi, 'getSubscription').mockResolvedValue({
      ok: true,
      subscription: subscription(),
    })
    mockCatalog()
    vi.spyOn(subscriptionsApi, 'changePlan').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'change_plan_failed',
    })

    renderPage()
    await screen.findByTestId('plan-option-variant-3x-tri')
    await userEvent.click(
      within(screen.getByTestId('plan-option-variant-3x-tri')).getByRole('radio'),
    )
    await userEvent.click(screen.getByRole('button', { name: 'CONFIRMAR TROCA — R$ 50,00' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível confirmar/i)
  })
})
