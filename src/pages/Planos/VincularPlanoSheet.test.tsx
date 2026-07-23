import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as membersApi from '../../lib/api/members'
import type { Member } from '../../lib/api/members'
import * as plansApi from '../../lib/api/plans'
import type { PlanDetail, PlanSummary } from '../../lib/api/plans'
import * as subscriptionsApi from '../../lib/api/subscriptions'
import { VincularPlanoSheet } from './VincularPlanoSheet'

afterEach(() => {
  vi.restoreAllMocks()
})

function student(overrides: Partial<Member> = {}): Member {
  return {
    membershipId: 'membership-aluno-1',
    user: { id: 'student-1', name: 'João Pedro', email: 'joao@example.com', avatarUrl: null },
    role: { id: 'role-aluno', name: 'Aluno' },
    ...overrides,
  }
}

function professor(overrides: Partial<Member> = {}): Member {
  return {
    membershipId: 'membership-prof-1',
    user: { id: 'prof-1', name: 'Marcus Lima', email: 'marcus@example.com', avatarUrl: null },
    role: { id: 'role-professor', name: 'Professor' },
    ...overrides,
  }
}

function planSummary(overrides: Partial<PlanSummary> = {}): PlanSummary {
  return {
    id: 'plan-1',
    name: '3x/semana Beach Tennis',
    type: 'mensalidade',
    sport: 'beach_tennis',
    maxMembers: 1,
    isActive: true,
    variantCount: 2,
    activeSubscriberCount: 5,
    startingPrice: 315,
    ...overrides,
  }
}

function planDetail(overrides: Partial<PlanDetail> = {}): PlanDetail {
  return {
    id: 'plan-1',
    unitId: 'unit-1',
    name: '3x/semana Beach Tennis',
    type: 'mensalidade',
    sport: 'beach_tennis',
    maxMembers: 1,
    description: null,
    isActive: true,
    variants: [
      {
        id: 'variant-mensal',
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
        id: 'variant-trimestral',
        planId: 'plan-1',
        billingCycle: 'trimestral',
        basePrice: 350,
        discountPercent: 10,
        finalPrice: 315,
        sessionsPerWeek: 3,
        totalSessions: null,
        isActive: true,
      },
      {
        id: 'variant-inativa',
        planId: 'plan-1',
        billingCycle: 'anual',
        basePrice: 350,
        discountPercent: 20,
        finalPrice: 280,
        sessionsPerWeek: 3,
        totalSessions: null,
        isActive: false,
      },
    ],
    ...overrides,
  }
}

function mockBasics() {
  vi.spyOn(membersApi, 'listMembers').mockResolvedValue({
    ok: true,
    members: [student(), professor()],
  })
  vi.spyOn(plansApi, 'listPlans').mockResolvedValue({
    ok: true,
    groups: [{ sport: 'beach_tennis', plans: [planSummary()] }],
  })
  vi.spyOn(plansApi, 'getPlanForEdit').mockResolvedValue({ ok: true, plan: planDetail() })
  // Default: aluno sem assinatura ativa (caminho normal, sem aviso) — testes
  // que precisam do caminho "assinatura ativa" (BEAC-1974) sobrescrevem este
  // mock individualmente.
  vi.spyOn(subscriptionsApi, 'getSubscription').mockResolvedValue({
    ok: false,
    status: 404,
    error: 'subscription_not_found',
  })
}

function activeSubscriptionDetail(
  overrides: Partial<subscriptionsApi.SubscriptionDetail> = {},
): subscriptionsApi.SubscriptionDetail {
  return {
    id: 'sub-existing-1',
    studentId: 'student-1',
    plan: { id: 'plan-existing', name: 'Mensal Beach Tennis' },
    planVariant: { id: 'variant-existing', billingCycle: 'mensal', finalPrice: 280 },
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    remainingDays: 9,
    status: 'active',
    autoRenew: true,
    creditBalance: 0,
    invoices: [],
    ...overrides,
  }
}

function renderSheet(onClose = vi.fn(), onLinked = vi.fn()) {
  render(<VincularPlanoSheet unitId="unit-1" onClose={onClose} onLinked={onLinked} />)
  return { onClose, onLinked }
}

async function selectStudentPlanAndVariant() {
  await userEvent.click(await screen.findByText('João Pedro'))
  await userEvent.selectOptions(await screen.findByLabelText('Plano'), 'plan-1')
  await userEvent.click(await screen.findByRole('button', { name: /trimestral r\$ 315,00/i }))
}

describe('VincularPlanoSheet — campos (BEAC-1936 AC)', () => {
  it('searches students filtered to role Aluno only, excluding other roles', async () => {
    mockBasics()
    renderSheet()

    expect(await screen.findByText('João Pedro')).toBeInTheDocument()
    expect(screen.queryByText('Marcus Lima')).not.toBeInTheDocument()
  })

  it('shows the Recorrência tabs with each active variant price from the API, once a Plano is selected — inactive variants are excluded', async () => {
    mockBasics()
    renderSheet()

    await userEvent.click(await screen.findByText('João Pedro'))
    await userEvent.selectOptions(await screen.findByLabelText('Plano'), 'plan-1')

    expect(await screen.findByRole('button', { name: /mensal r\$ 350,00/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /trimestral r\$ 315,00/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /anual/i })).not.toBeInTheDocument()
  })

  it('has Início (date), Método (PIX/Cartão/Dinheiro) and both checkboxes checked by default', async () => {
    mockBasics()
    renderSheet()

    expect(screen.getByRole('button', { name: 'PIX' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cartão' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dinheiro' })).toBeInTheDocument()
    expect(screen.getByLabelText('Renovação automática')).toBeChecked()
    expect(screen.getByLabelText('Gerar primeira fatura agora')).toBeChecked()
  })

  it('disables the submit button until Aluno/Plano+Recorrência/Início/Método are all filled', async () => {
    mockBasics()
    renderSheet()

    expect(screen.getByRole('button', { name: /vincular e gerar fatura/i })).toBeDisabled()

    await selectStudentPlanAndVariant()
    expect(screen.getByRole('button', { name: /vincular e gerar fatura/i })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'PIX' }))
    expect(screen.getByRole('button', { name: /vincular e gerar fatura/i })).toBeEnabled()
  })

  it('changes the submit label to "Vincular plano" when "Gerar primeira fatura agora" is unchecked', async () => {
    mockBasics()
    renderSheet()

    await userEvent.click(screen.getByLabelText('Gerar primeira fatura agora'))

    expect(screen.getByRole('button', { name: 'Vincular plano' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /vincular e gerar fatura/i }),
    ).not.toBeInTheDocument()
  })
})

describe('VincularPlanoSheet — submit (BEAC-1932 endpoint)', () => {
  it('calls createSubscription with the exact payload built from the form', async () => {
    mockBasics()
    const createSpy = vi.spyOn(subscriptionsApi, 'createSubscription').mockResolvedValue({
      ok: true,
      subscription: {
        id: 'sub-1',
        studentId: 'student-1',
        planVariantId: 'variant-trimestral',
        startDate: '2026-07-22',
        endDate: '2026-10-21',
        status: 'active',
        paymentMethod: 'pix',
        autoRenew: true,
        creditBalance: 0,
      },
      periodTotal: 945,
      invoice: null,
    })
    renderSheet()

    await selectStudentPlanAndVariant()
    await userEvent.click(screen.getByRole('button', { name: 'PIX' }))
    await userEvent.click(screen.getByRole('button', { name: /vincular e gerar fatura/i }))

    expect(createSpy).toHaveBeenCalledWith('student-1', {
      planVariantId: 'variant-trimestral',
      startDate: expect.any(String),
      paymentMethod: 'pix',
      autoRenew: true,
      generateFirstInvoice: true,
    })
  })

  it('shows "Total do período" straight from the API response, not a frontend recomputation', async () => {
    mockBasics()
    // period_total propositalmente diferente de finalPrice(315) × 3 meses
    // (945) — se a tela mostrasse 945 aqui, seria prova de que ela
    // recalculou no frontend em vez de usar o valor da API.
    vi.spyOn(subscriptionsApi, 'createSubscription').mockResolvedValue({
      ok: true,
      subscription: {
        id: 'sub-1',
        studentId: 'student-1',
        planVariantId: 'variant-trimestral',
        startDate: '2026-07-22',
        endDate: '2026-10-21',
        status: 'active',
        paymentMethod: 'pix',
        autoRenew: true,
        creditBalance: 0,
      },
      periodTotal: 1234.56,
      invoice: null,
    })
    renderSheet()

    await selectStudentPlanAndVariant()
    await userEvent.click(screen.getByRole('button', { name: 'PIX' }))
    await userEvent.click(screen.getByRole('button', { name: /vincular e gerar fatura/i }))

    expect(await screen.findByText('Total do período: R$ 1.234,56')).toBeInTheDocument()
    expect(screen.queryByText(/945/)).not.toBeInTheDocument()
  })

  it('calls onLinked when "Concluir" is tapped on the success screen', async () => {
    mockBasics()
    vi.spyOn(subscriptionsApi, 'createSubscription').mockResolvedValue({
      ok: true,
      subscription: {
        id: 'sub-1',
        studentId: 'student-1',
        planVariantId: 'variant-trimestral',
        startDate: '2026-07-22',
        endDate: '2026-10-21',
        status: 'active',
        paymentMethod: 'pix',
        autoRenew: true,
        creditBalance: 0,
      },
      periodTotal: 945,
      invoice: null,
    })
    const { onLinked } = renderSheet()

    await selectStudentPlanAndVariant()
    await userEvent.click(screen.getByRole('button', { name: 'PIX' }))
    await userEvent.click(screen.getByRole('button', { name: /vincular e gerar fatura/i }))

    await userEvent.click(await screen.findByRole('button', { name: 'Concluir' }))
    expect(onLinked).toHaveBeenCalled()
  })

  it('shows the invalid_body message from the API on error (e.g. start_date no passado), without closing the sheet', async () => {
    mockBasics()
    vi.spyOn(subscriptionsApi, 'createSubscription').mockResolvedValue({
      ok: false,
      status: 400,
      error: 'invalid_body',
      message: 'start_date não pode ser no passado',
    })
    renderSheet()

    await selectStudentPlanAndVariant()
    await userEvent.click(screen.getByRole('button', { name: 'PIX' }))
    await userEvent.click(screen.getByRole('button', { name: /vincular e gerar fatura/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('start_date não pode ser no passado')
  })

  it('shows a friendly message on 403 forbidden (aluno tentando se auto-vincular)', async () => {
    mockBasics()
    vi.spyOn(subscriptionsApi, 'createSubscription').mockResolvedValue({
      ok: false,
      status: 403,
      error: 'forbidden',
    })
    renderSheet()

    await selectStudentPlanAndVariant()
    await userEvent.click(screen.getByRole('button', { name: 'PIX' }))
    await userEvent.click(screen.getByRole('button', { name: /vincular e gerar fatura/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/não tem permissão/i)
  })
})

describe('VincularPlanoSheet — aviso de assinatura já ativa (BEAC-1974, regra 6 parcial)', () => {
  it('queries GET /students/{id}/subscription on selecting an Aluno and shows the warning when it returns an active subscription (200)', async () => {
    mockBasics()
    vi.spyOn(subscriptionsApi, 'getSubscription').mockResolvedValue({
      ok: true,
      subscription: activeSubscriptionDetail({
        plan: { id: 'plan-x', name: 'Mensal Beach Tennis' },
      }),
    })
    renderSheet()

    await userEvent.click(await screen.findByText('João Pedro'))

    expect(subscriptionsApi.getSubscription).toHaveBeenCalledWith('student-1')
    expect(
      await screen.findByText(
        'Aluno já tem plano ativo: Mensal Beach Tennis. Vincular um novo plano será bloqueado até a assinatura atual ser cancelada.',
      ),
    ).toBeInTheDocument()
  })

  it('shows no warning when GET /students/{id}/subscription returns 404 (aluno sem assinatura ativa)', async () => {
    mockBasics()
    renderSheet()

    await userEvent.click(await screen.findByText('João Pedro'))
    await screen.findByLabelText('Plano')

    expect(screen.queryByText(/já tem plano ativo/i)).not.toBeInTheDocument()
  })

  it('keeps the submit button enabled even while the warning is visible (informational only, not a UI block)', async () => {
    mockBasics()
    vi.spyOn(subscriptionsApi, 'getSubscription').mockResolvedValue({
      ok: true,
      subscription: activeSubscriptionDetail(),
    })
    renderSheet()

    await screen.findByText('João Pedro')
    await selectStudentPlanAndVariant()
    await screen.findByText(/já tem plano ativo/i)
    await userEvent.click(screen.getByRole('button', { name: 'PIX' }))

    expect(screen.getByRole('button', { name: /vincular e gerar fatura/i })).toBeEnabled()
  })

  it('shows a specific message reusing the existing subscription plan name when submit fails with 409 active_subscription_exists', async () => {
    mockBasics()
    vi.spyOn(subscriptionsApi, 'getSubscription').mockResolvedValue({
      ok: true,
      subscription: activeSubscriptionDetail({
        plan: { id: 'plan-x', name: 'Trimestral Beach Tennis' },
      }),
    })
    vi.spyOn(subscriptionsApi, 'createSubscription').mockResolvedValue({
      ok: false,
      status: 409,
      error: 'active_subscription_exists',
      message: 'aluno já tem uma assinatura ativa',
      subscriptionId: 'sub-existing-1',
    })
    renderSheet()

    await selectStudentPlanAndVariant()
    await screen.findByText(/já tem plano ativo/i)
    await userEvent.click(screen.getByRole('button', { name: 'PIX' }))
    await userEvent.click(screen.getByRole('button', { name: /vincular e gerar fatura/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Aluno já tem plano ativo: Trimestral Beach Tennis')
    expect(alert).not.toHaveTextContent('Não foi possível vincular o plano agora')
  })

  it('falls back to the 409 subscription_id when no cached plan name is available (e.g. subscription created after the earlier check)', async () => {
    mockBasics()
    // getSubscription mockado como default (404) — nenhum aviso foi
    // mostrado, mas o submit ainda assim colide com um 409 (corrida).
    vi.spyOn(subscriptionsApi, 'createSubscription').mockResolvedValue({
      ok: false,
      status: 409,
      error: 'active_subscription_exists',
      message: 'aluno já tem uma assinatura ativa',
      subscriptionId: 'sub-race-1',
    })
    renderSheet()

    await selectStudentPlanAndVariant()
    await userEvent.click(screen.getByRole('button', { name: 'PIX' }))
    await userEvent.click(screen.getByRole('button', { name: /vincular e gerar fatura/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('sub-race-1')
  })
})

describe('VincularPlanoSheet — cancelar', () => {
  it('calls onClose when Cancelar is tapped', async () => {
    mockBasics()
    const { onClose } = renderSheet()

    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))

    expect(onClose).toHaveBeenCalled()
  })
})
