import { fireEvent, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../lib/api'
import type { MembershipListItem } from '../../lib/api'
import * as invoicesApi from '../../lib/api/invoices'
import type { InvoiceListItem, ListInvoicesResult } from '../../lib/api/invoices'
import * as reportsApi from '../../lib/api/reports'
import * as tenantContext from '../../lib/tenantContext'
import { renderWithPermissions } from '../../test/renderWithPermissions'
import F1CashFlowPage from './F1CashFlowPage'

function membership(overrides: Partial<MembershipListItem> = {}): MembershipListItem {
  return {
    unitId: 'unit-1',
    unit: { name: 'Arena Areia Dourada', address: null, sportsOffered: null },
    role: 'Unit Admin',
    lastAccessedAt: null,
    liveActivity: null,
    ...overrides,
  }
}

const oneMembershipUnitAdmin = [membership()]
const oneMembershipTenantOwner = [membership({ role: 'Tenant Owner' })]
const twoMembershipsTenantOwner = [
  membership({
    unitId: 'unit-1',
    unit: { name: 'Matriz', address: null, sportsOffered: null },
    role: 'Tenant Owner',
  }),
  membership({
    unitId: 'unit-2',
    unit: { name: 'Filial', address: null, sportsOffered: null },
    role: 'Tenant Owner',
  }),
]

function invoice(overrides: Partial<InvoiceListItem> = {}): InvoiceListItem {
  return {
    id: 'inv-1',
    studentId: 's-1',
    studentName: 'Aluno',
    sourceType: 'subscription',
    description: 'Mensalidade',
    amount: 200,
    dueDate: '2026-03-10',
    status: 'paga',
    daysOverdue: null,
    paymentMethod: null,
    paidAt: '2026-03-05',
    ...overrides,
  }
}

function invoicesOk(invoices: InvoiceListItem[]): ListInvoicesResult {
  return { ok: true, invoices, total: invoices.length }
}

afterEach(() => {
  vi.restoreAllMocks()
})

function renderPage(unitId = 'unit-1') {
  return renderWithPermissions(
    <MemoryRouter initialEntries={[`/units/${unitId}/cashflow`]}>
      <Routes>
        <Route path="/units/:unitId/cashflow" element={<F1CashFlowPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('F1CashFlowPage — visão por-unit (default, sem seletor pra Unit Admin)', () => {
  it('Unit Admin never sees the unit filter — hidden, not disabled', async () => {
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue(oneMembershipUnitAdmin)
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue(invoicesOk([invoice()]))

    renderPage()

    await screen.findByText('R$ 200,00')
    expect(screen.queryByLabelText('Filtrar por unit')).not.toBeInTheDocument()
  })

  it('renders receita/saldo from GET /units/{id}/invoices (unaffected by BEAC-1970)', async () => {
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue(oneMembershipUnitAdmin)
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue(
      invoicesOk([invoice({ amount: 300, status: 'paga', sourceType: 'subscription' })]),
    )

    renderPage()

    expect((await screen.findAllByText('R$ 300,00')).length).toBeGreaterThan(0)
    expect(screen.getByText(/mensalidades/i)).toBeInTheDocument()
  })
})

describe('F1CashFlowPage — seletor de unit/"Todas" (BEAC-1970)', () => {
  it('Tenant Owner (even with exactly 1 membership) sees the selector with "Todas" plus every unit', async () => {
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue(oneMembershipTenantOwner)
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue(invoicesOk([]))

    renderPage()

    const select = await screen.findByLabelText('Filtrar por unit')
    const options = screen.getAllByRole('option').map((o) => o.textContent)
    expect(options).toContain('Todas')
    expect(select).toBeInTheDocument()
  })

  it('selecting "Todas" calls getNetworkReport (3x, for the trailing 3 months) instead of listInvoices', async () => {
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue(twoMembershipsTenantOwner)
    const invoicesSpy = vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue(invoicesOk([]))
    vi.spyOn(tenantContext, 'getActiveTenantId').mockReturnValue('tenant-1')
    const networkSpy = vi.spyOn(reportsApi, 'getNetworkReport').mockResolvedValue({
      ok: true,
      report: {
        type: 'fluxo-de-caixa',
        period: '2026-03',
        available: true,
        reason: null,
        totalAmount: null,
        totalClassesCount: null,
        teacherRevenue: [],
        cashFlow: {
          summary: {
            receita: 900,
            despesas: 0,
            saldo: 900,
            recebido: 800,
            aReceber: 50,
            emAtraso: 50,
          },
          categories: [
            { sourceType: 'subscription', amount: 800 },
            { sourceType: 'adhoc', amount: 100 },
          ],
        },
        delinquency: null,
        revenueBySport: null,
        dre: null,
        dayUse: null,
      },
    })

    renderPage()
    invoicesSpy.mockClear()

    fireEvent.change(await screen.findByLabelText('Filtrar por unit'), {
      target: { value: 'network' },
    })

    expect((await screen.findAllByText('R$ 900,00')).length).toBeGreaterThan(0)
    expect(screen.getByText(/mensalidades/i)).toBeInTheDocument()
    await waitFor(() => expect(networkSpy).toHaveBeenCalledTimes(3))
    for (const call of networkSpy.mock.calls) {
      expect(call[0]).toBe('tenant-1')
      expect(call[1]).toBe('fluxo-de-caixa')
    }
    expect(invoicesSpy).not.toHaveBeenCalled()
  })

  it('switching back to a specific unit resumes GET /units/{id}/invoices', async () => {
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue(twoMembershipsTenantOwner)
    const invoicesSpy = vi
      .spyOn(invoicesApi, 'listInvoices')
      .mockResolvedValue(invoicesOk([invoice({ amount: 150 })]))
    vi.spyOn(tenantContext, 'getActiveTenantId').mockReturnValue('tenant-1')
    vi.spyOn(reportsApi, 'getNetworkReport').mockResolvedValue({
      ok: true,
      report: {
        type: 'fluxo-de-caixa',
        period: '2026-03',
        available: true,
        reason: null,
        totalAmount: null,
        totalClassesCount: null,
        teacherRevenue: [],
        cashFlow: {
          summary: {
            receita: 900,
            despesas: 0,
            saldo: 900,
            recebido: 900,
            aReceber: 0,
            emAtraso: 0,
          },
          categories: [],
        },
        delinquency: null,
        revenueBySport: null,
        dre: null,
        dayUse: null,
      },
    })

    renderPage('unit-1')
    const select = await screen.findByLabelText('Filtrar por unit')

    fireEvent.change(select, { target: { value: 'network' } })
    await waitFor(() =>
      expect((screen.queryAllByText('R$ 900,00') ?? []).length).toBeGreaterThan(0),
    )

    invoicesSpy.mockClear()
    fireEvent.change(select, { target: { value: 'unit-2' } })

    await waitFor(() => expect(invoicesSpy).toHaveBeenCalled())
    expect(invoicesSpy.mock.calls.every((call) => call[0] === 'unit-2')).toBe(true)
  })

  it('shows the error state instead of hanging when "Todas" is selected but no active tenant is known', async () => {
    vi.spyOn(api, 'listMyMemberships').mockResolvedValue(twoMembershipsTenantOwner)
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue(invoicesOk([]))
    vi.spyOn(tenantContext, 'getActiveTenantId').mockReturnValue(null)
    const networkSpy = vi.spyOn(reportsApi, 'getNetworkReport')

    renderPage()

    fireEvent.change(await screen.findByLabelText('Filtrar por unit'), {
      target: { value: 'network' },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
    expect(networkSpy).not.toHaveBeenCalled()
  })
})
