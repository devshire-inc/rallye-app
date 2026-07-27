import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as meApi from '../../lib/api/me'
import * as subscriptionsApi from '../../lib/api/subscriptions'
import type { SubscriptionDetail } from '../../lib/api/subscriptions'
import PL4MySubscriptionPage from './PL4MySubscriptionPage'

afterEach(() => {
  vi.restoreAllMocks()
})

function subscription(overrides: Partial<SubscriptionDetail> = {}): SubscriptionDetail {
  return {
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
        id: 'inv-1',
        studentId: 'student-1',
        sourceType: 'subscription',
        sourceId: 'sub-1',
        description: 'Mensalidade Mar/26',
        // Deliberadamente diferente do preço da variante (315): evita que
        // getByText('R$ 315,00...') abaixo case tanto com a linha
        // "Recorrência" quanto com a linha da fatura.
        amount: 300,
        dueDate: '2026-03-05',
        status: 'paga',
      },
    ],
    ...overrides,
  }
}

function renderPage(unitId = 'unit-1') {
  return render(
    <MemoryRouter initialEntries={[`/units/${unitId}/my-subscription`]}>
      <Routes>
        <Route path="/units/:unitId/my-subscription" element={<PL4MySubscriptionPage />} />
        <Route
          path="/units/:unitId/my-subscription/change-plan"
          element={<div>PL5 placeholder</div>}
        />
        <Route path="/units/:unitId/dashboard" element={<div>Dashboard placeholder</div>} />
        <Route path="/invoices/:invoiceId" element={<div>F3 placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PL4MySubscriptionPage — loading and error', () => {
  it('shows a loading status while the subscription is being fetched', () => {
    vi.spyOn(meApi, 'getMe').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error message when GET /me fails', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: false, status: 500, error: 'x' })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
  })

  it('shows an error message when the subscription fetch fails with a non-404 error', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'student-1', fullName: 'Usuária de Teste' })
    vi.spyOn(subscriptionsApi, 'getSubscription').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'get_subscription_failed',
    })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
  })
})

describe('PL4MySubscriptionPage — empty state (no active subscription)', () => {
  it('shows a "no active plan" message on 404 subscription_not_found', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'student-1', fullName: 'Usuária de Teste' })
    vi.spyOn(subscriptionsApi, 'getSubscription').mockResolvedValue({
      ok: false,
      status: 404,
      error: 'subscription_not_found',
    })

    renderPage()

    expect(
      await screen.findByText('Nenhum plano ativo. Fale com a recepção para contratar.'),
    ).toBeInTheDocument()
  })
})

describe('PL4MySubscriptionPage — active subscription card', () => {
  it('shows plan name, "Ativa" badge, recorrência+preço, período, renewal countdown and progress', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'student-1', fullName: 'Usuária de Teste' })
    vi.spyOn(subscriptionsApi, 'getSubscription').mockResolvedValue({
      ok: true,
      subscription: subscription(),
    })

    renderPage()

    await screen.findByText('3x/semana Beach Tennis')
    expect(screen.getByText('Ativa')).toBeInTheDocument()
    expect(screen.getByText('Trimestral · R$ 315,00/mês')).toBeInTheDocument()
    expect(screen.getByText('01/01/2026 - 31/03/2026')).toBeInTheDocument()
    expect(screen.getByText('20 dias')).toBeInTheDocument()
    expect(screen.getByText('Sim')).toBeInTheDocument()
    // 90 dias totais (01/01 a 31/03/26 inclusive), 20 restantes -> 78%.
    expect(screen.getByText('78% do período')).toBeInTheDocument()
  })

  it('shows the exact foot-note copy from the prototype', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'student-1', fullName: 'Usuária de Teste' })
    vi.spyOn(subscriptionsApi, 'getSubscription').mockResolvedValue({
      ok: true,
      subscription: subscription(),
    })

    renderPage()

    await screen.findByText('3x/semana Beach Tennis')
    expect(
      screen.getByText(
        'Cancelar vale até o fim do período pago (não é imediato). Aluno não contrata sozinho — o admin vincula (PL3); mas pode trocar/cancelar.',
      ),
    ).toBeInTheDocument()
  })

  it('shows the invoice history from the subscription response, with status and amount', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'student-1', fullName: 'Usuária de Teste' })
    vi.spyOn(subscriptionsApi, 'getSubscription').mockResolvedValue({
      ok: true,
      subscription: subscription(),
    })

    renderPage()

    await screen.findByText('Mensalidade Mar/26')
    expect(screen.getByText(/R\$ 300,00/)).toBeInTheDocument()
    expect(screen.getByText('Paga')).toBeInTheDocument()
  })

  it('does not issue a second invoice-listing call — uses the subscription response invoices array', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'student-1', fullName: 'Usuária de Teste' })
    const getSubscriptionSpy = vi
      .spyOn(subscriptionsApi, 'getSubscription')
      .mockResolvedValue({ ok: true, subscription: subscription() })

    renderPage()

    await screen.findByText('Mensalidade Mar/26')
    expect(getSubscriptionSpy).toHaveBeenCalledTimes(1)
    expect(getSubscriptionSpy).toHaveBeenCalledWith('student-1')
  })
})

describe('PL4MySubscriptionPage — actions', () => {
  it('navigates to the PL5 route when "Trocar plano" is tapped', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'student-1', fullName: 'Usuária de Teste' })
    vi.spyOn(subscriptionsApi, 'getSubscription').mockResolvedValue({
      ok: true,
      subscription: subscription(),
    })

    renderPage()
    await screen.findByText('3x/semana Beach Tennis')

    await userEvent.click(screen.getByRole('button', { name: 'Trocar plano' }))

    expect(await screen.findByText('PL5 placeholder')).toBeInTheDocument()
  })

  it('shows a "not yet available" explanation instead of a fabricated call when "Cancelar assinatura" is tapped', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'student-1', fullName: 'Usuária de Teste' })
    const getSubscriptionSpy = vi
      .spyOn(subscriptionsApi, 'getSubscription')
      .mockResolvedValue({ ok: true, subscription: subscription() })

    renderPage()
    await screen.findByText('3x/semana Beach Tennis')

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar assinatura' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/ainda não/i)).toBeInTheDocument()
    // Nenhuma chamada extra foi disparada — só a leitura inicial da tela.
    expect(getSubscriptionSpy).toHaveBeenCalledTimes(1)
  })

  it('navigates to F3 (invoice detail) when an invoice row is tapped', async () => {
    vi.spyOn(meApi, 'getMe').mockResolvedValue({ ok: true, id: 'student-1', fullName: 'Usuária de Teste' })
    vi.spyOn(subscriptionsApi, 'getSubscription').mockResolvedValue({
      ok: true,
      subscription: subscription(),
    })

    renderPage()
    await screen.findByText('Mensalidade Mar/26')

    await userEvent.click(screen.getByText('Mensalidade Mar/26'))

    expect(await screen.findByText('F3 placeholder')).toBeInTheDocument()
  })
})
