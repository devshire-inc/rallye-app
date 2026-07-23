import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import { changePlan, createSubscription, getSubscription } from './subscriptions'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createSubscription', () => {
  it('POSTs /students/{id}/subscriptions with the snake_case body and maps the response back to camelCase', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(201, {
        subscription: {
          id: 'sub-1',
          student_id: 'student-1',
          plan_variant_id: 'variant-1',
          start_date: '2026-04-01',
          end_date: '2026-06-30',
          status: 'active',
          payment_method: 'pix',
          auto_renew: true,
          credit_balance: 0,
        },
        period_total: 945,
        invoice: {
          id: 'invoice-1',
          student_id: 'student-1',
          source_type: 'subscription',
          source_id: 'sub-1',
          description: '3x/semana Beach Tennis · trimestral',
          amount: 945,
          due_date: '2026-04-01',
          status: 'gerada',
        },
      }),
    )

    const result = await createSubscription('student-1', {
      planVariantId: 'variant-1',
      startDate: '2026-04-01',
      paymentMethod: 'pix',
      autoRenew: true,
      generateFirstInvoice: true,
    })

    expect(apiFetchMock).toHaveBeenCalledWith('/students/student-1/subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        plan_variant_id: 'variant-1',
        start_date: '2026-04-01',
        payment_method: 'pix',
        auto_renew: true,
        generate_first_invoice: true,
      }),
    })
    expect(result).toEqual({
      ok: true,
      subscription: {
        id: 'sub-1',
        studentId: 'student-1',
        planVariantId: 'variant-1',
        startDate: '2026-04-01',
        endDate: '2026-06-30',
        status: 'active',
        paymentMethod: 'pix',
        autoRenew: true,
        creditBalance: 0,
      },
      periodTotal: 945,
      invoice: {
        id: 'invoice-1',
        studentId: 'student-1',
        sourceType: 'subscription',
        sourceId: 'sub-1',
        description: '3x/semana Beach Tennis · trimestral',
        amount: 945,
        dueDate: '2026-04-01',
        status: 'gerada',
      },
    })
  })

  it('maps invoice: null (generate_first_invoice=false) to invoice: null', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(201, {
        subscription: {
          id: 'sub-2',
          student_id: 'student-1',
          plan_variant_id: 'variant-1',
          start_date: '2026-04-01',
          end_date: '2026-04-30',
          status: 'active',
          payment_method: 'cartao',
          auto_renew: false,
          credit_balance: 0,
        },
        period_total: 350,
        invoice: null,
      }),
    )

    const result = await createSubscription('student-1', {
      planVariantId: 'variant-1',
      startDate: '2026-04-01',
      paymentMethod: 'cartao',
      autoRenew: false,
      generateFirstInvoice: false,
    })

    expect(result.ok).toBe(true)
    expect(result.ok && result.invoice).toBeNull()
  })

  it('returns the error + message from a 400 invalid_body response (e.g. start_date no passado)', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(400, {
        error: 'invalid_body',
        message: 'start_date não pode ser no passado',
      }),
    )

    const result = await createSubscription('student-1', {
      planVariantId: 'variant-1',
      startDate: '2020-01-01',
      paymentMethod: 'pix',
      autoRenew: true,
      generateFirstInvoice: true,
    })

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'invalid_body',
      message: 'start_date não pode ser no passado',
    })
  })

  it('returns 403 forbidden as-is (Aluno tentando se auto-vincular)', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(403, { error: 'forbidden' }))

    const result = await createSubscription('student-1', {
      planVariantId: 'variant-1',
      startDate: '2026-04-01',
      paymentMethod: 'pix',
      autoRenew: true,
      generateFirstInvoice: true,
    })

    expect(result).toEqual({ ok: false, status: 403, error: 'forbidden', message: undefined })
  })

  it('returns 404 student_not_found as-is', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(404, { error: 'student_not_found' }))

    const result = await createSubscription('student-404', {
      planVariantId: 'variant-1',
      startDate: '2026-04-01',
      paymentMethod: 'pix',
      autoRenew: true,
      generateFirstInvoice: true,
    })

    expect(result).toEqual({
      ok: false,
      status: 404,
      error: 'student_not_found',
      message: undefined,
    })
  })

  it('returns 409 active_subscription_exists with subscriptionId mapped from subscription_id (BEAC-1973/1974)', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(409, {
        error: 'active_subscription_exists',
        message: 'aluno já tem uma assinatura ativa',
        subscription_id: 'sub-existing-1',
      }),
    )

    const result = await createSubscription('student-1', {
      planVariantId: 'variant-1',
      startDate: '2026-04-01',
      paymentMethod: 'pix',
      autoRenew: true,
      generateFirstInvoice: true,
    })

    expect(result).toEqual({
      ok: false,
      status: 409,
      error: 'active_subscription_exists',
      message: 'aluno já tem uma assinatura ativa',
      subscriptionId: 'sub-existing-1',
    })
  })
})

describe('getSubscription', () => {
  it('GETs /students/{id}/subscription and maps plan/plan_variant/invoices back to camelCase (BEAC-1972, PL4)', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        id: 'sub-1',
        student_id: 'student-1',
        plan: { id: 'plan-1', name: '3x/semana Beach Tennis' },
        plan_variant: { id: 'variant-1', billing_cycle: 'trimestral', final_price: 315 },
        start_date: '2026-01-01',
        end_date: '2026-03-31',
        remaining_days: 20,
        status: 'active',
        auto_renew: true,
        credit_balance: 0,
        invoices: [
          {
            id: 'invoice-1',
            student_id: 'student-1',
            source_type: 'subscription',
            source_id: 'sub-1',
            description: 'Mensalidade Mar/26',
            amount: 315,
            due_date: '2026-03-05',
            status: 'paga',
          },
        ],
      }),
    )

    const result = await getSubscription('student-1')

    expect(apiFetchMock).toHaveBeenCalledWith('/students/student-1/subscription')
    expect(result).toEqual({
      ok: true,
      subscription: {
        id: 'sub-1',
        studentId: 'student-1',
        plan: { id: 'plan-1', name: '3x/semana Beach Tennis' },
        planVariant: { id: 'variant-1', billingCycle: 'trimestral', finalPrice: 315 },
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        remainingDays: 20,
        status: 'active',
        autoRenew: true,
        creditBalance: 0,
        invoices: [
          {
            id: 'invoice-1',
            studentId: 'student-1',
            sourceType: 'subscription',
            sourceId: 'sub-1',
            description: 'Mensalidade Mar/26',
            amount: 315,
            dueDate: '2026-03-05',
            status: 'paga',
          },
        ],
      },
    })
  })

  it('maps invoices: [] to an empty array (assinatura recém-criada, sem faturas ainda)', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        id: 'sub-2',
        student_id: 'student-1',
        plan: { id: 'plan-1', name: 'Mensal BT' },
        plan_variant: { id: 'variant-2', billing_cycle: 'mensal', final_price: 280 },
        start_date: '2026-07-01',
        end_date: '2026-07-31',
        remaining_days: 9,
        status: 'active',
        auto_renew: false,
        credit_balance: 0,
        invoices: [],
      }),
    )

    const result = await getSubscription('student-1')

    expect(result.ok).toBe(true)
    expect(result.ok && result.subscription.invoices).toEqual([])
  })

  it('returns 404 subscription_not_found as-is (aluno sem assinatura ativa — estado esperado pela tela, não uma falha)', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(404, { error: 'subscription_not_found' }))

    const result = await getSubscription('student-1')

    expect(result).toEqual({
      ok: false,
      status: 404,
      error: 'subscription_not_found',
      message: undefined,
    })
  })

  it('returns 403 forbidden as-is (aluno tentando ver a assinatura de outro aluno)', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(403, { error: 'forbidden' }))

    const result = await getSubscription('other-student')

    expect(result).toEqual({ ok: false, status: 403, error: 'forbidden', message: undefined })
  })
})

describe('changePlan', () => {
  it('POSTs /subscriptions/{id}/change-plan with new_plan_variant_id and maps an upgrade response (positive prorated_amount + invoice)', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        subscription: {
          id: 'sub-1',
          student_id: 'student-1',
          plan_variant_id: 'variant-3x',
          start_date: '2026-01-01',
          end_date: '2026-01-30',
          status: 'active',
          payment_method: 'pix',
          auto_renew: true,
          credit_balance: 0,
        },
        prorated_amount: 50,
        invoice: {
          id: 'invoice-9',
          student_id: 'student-1',
          source_type: 'subscription',
          source_id: 'sub-1',
          description: 'Troca de plano — diferença pro-rata (2x/semana BT → 3x/semana BT)',
          amount: 50,
          due_date: '2026-01-15',
          status: 'gerada',
        },
      }),
    )

    const result = await changePlan('sub-1', 'variant-3x')

    expect(apiFetchMock).toHaveBeenCalledWith('/subscriptions/sub-1/change-plan', {
      method: 'POST',
      body: JSON.stringify({ new_plan_variant_id: 'variant-3x' }),
    })
    expect(result).toEqual({
      ok: true,
      subscription: {
        id: 'sub-1',
        studentId: 'student-1',
        planVariantId: 'variant-3x',
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
        description: 'Troca de plano — diferença pro-rata (2x/semana BT → 3x/semana BT)',
        amount: 50,
        dueDate: '2026-01-15',
        status: 'gerada',
      },
    })
  })

  it('maps a downgrade response (negative prorated_amount, invoice: null, credit_balance incremented)', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        subscription: {
          id: 'sub-1',
          student_id: 'student-1',
          plan_variant_id: 'variant-mensal',
          start_date: '2026-01-01',
          end_date: '2026-01-30',
          status: 'active',
          payment_method: 'pix',
          auto_renew: true,
          credit_balance: 50,
        },
        prorated_amount: -50,
        invoice: null,
      }),
    )

    const result = await changePlan('sub-1', 'variant-mensal')

    expect(result.ok).toBe(true)
    expect(result.ok && result.proratedAmount).toBe(-50)
    expect(result.ok && result.invoice).toBeNull()
    expect(result.ok && result.subscription.creditBalance).toBe(50)
  })

  it('returns the error + message from a 400 invalid_body response (e.g. recorrência diferente)', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(400, {
        error: 'invalid_body',
        message:
          'recorrência é mantida — selecione uma variante com a mesma recorrência do plano atual (PL5 regra 5)',
      }),
    )

    const result = await changePlan('sub-1', 'variant-anual')

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'invalid_body',
      message:
        'recorrência é mantida — selecione uma variante com a mesma recorrência do plano atual (PL5 regra 5)',
    })
  })

  it('returns 403 forbidden as-is (aluno tentando trocar plano de outro aluno, sem financeiro:write)', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(403, { error: 'forbidden' }))

    const result = await changePlan('sub-1', 'variant-3x')

    expect(result).toEqual({ ok: false, status: 403, error: 'forbidden', message: undefined })
  })

  it('returns 404 subscription_not_found as-is', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(404, { error: 'subscription_not_found' }))

    const result = await changePlan('sub-404', 'variant-3x')

    expect(result).toEqual({
      ok: false,
      status: 404,
      error: 'subscription_not_found',
      message: undefined,
    })
  })
})
