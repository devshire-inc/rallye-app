import { screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as reportsApi from '../lib/api/reports'
import type { Report } from '../lib/api/reports'
import * as tenantContext from '../lib/tenantContext'
import { renderWithPermissions } from '../test/renderWithPermissions'
import OW1Dashboard from './OW1Dashboard'

function report(overrides: Partial<Report> = {}): Report {
  return {
    type: 'fluxo-de-caixa',
    period: '2026-07',
    available: true,
    reason: null,
    totalAmount: null,
    totalClassesCount: null,
    teacherRevenue: [],
    cashFlow: null,
    delinquency: null,
    revenueBySport: null,
    dre: null,
    dayUse: null,
    ...overrides,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

function renderPage() {
  return renderWithPermissions(
    <MemoryRouter>
      <OW1Dashboard />
    </MemoryRouter>,
  )
}

describe('OW1Dashboard', () => {
  it('shows the 2 network-aggregated KPI tiles from GET /tenants/{id}/reports/{type}, no unit_id', async () => {
    vi.spyOn(tenantContext, 'getActiveTenantId').mockReturnValue('tenant-1')
    const networkReportSpy = vi.spyOn(reportsApi, 'getNetworkReport').mockImplementation((_tenantId, type) => {
      if (type === 'fluxo-de-caixa') {
        return Promise.resolve({
          ok: true,
          report: report({
            type: 'fluxo-de-caixa',
            cashFlow: {
              summary: { receita: 42000, despesas: 9000, saldo: 33000, recebido: 38000, aReceber: 4000, emAtraso: 2000 },
              categories: [],
            },
          }),
        })
      }
      return Promise.resolve({
        ok: true,
        report: report({
          type: 'inadimplencia',
          delinquency: { summary: { totalAmount: 7300, studentsCount: 9 }, items: [] },
        }),
      })
    })

    renderPage()

    const kpis = await screen.findByTestId('dashboard-kpis')
    await waitFor(() => expect(within(kpis).getByText('R$ 42.000,00')).toBeInTheDocument())
    expect(within(kpis).getByText('R$ 7.300,00')).toBeInTheDocument()

    expect(networkReportSpy).toHaveBeenCalledWith('tenant-1', 'fluxo-de-caixa')
    expect(networkReportSpy).toHaveBeenCalledWith('tenant-1', 'inadimplencia')
  })

  it('displays the backend-aggregated value as-is, without re-summing per unit on the frontend', async () => {
    vi.spyOn(tenantContext, 'getActiveTenantId').mockReturnValue('tenant-1')
    vi.spyOn(reportsApi, 'getNetworkReport').mockImplementation((_tenantId, type) => {
      if (type === 'fluxo-de-caixa') {
        return Promise.resolve({
          ok: true,
          report: report({
            type: 'fluxo-de-caixa',
            // Valor já agregado pelo backend de >1 unit — o componente só exibe.
            cashFlow: {
              summary: { receita: 99999, despesas: 0, saldo: 99999, recebido: 99999, aReceber: 0, emAtraso: 0 },
              categories: [],
            },
          }),
        })
      }
      return Promise.resolve({
        ok: true,
        report: report({ type: 'inadimplencia', delinquency: { summary: { totalAmount: 0, studentsCount: 0 }, items: [] } }),
      })
    })

    renderPage()

    const kpis = await screen.findByTestId('dashboard-kpis')
    await waitFor(() => expect(within(kpis).getByText('R$ 99.999,00')).toBeInTheDocument())
  })

  it('renders nothing scary and no crash when there is no active tenant', () => {
    vi.spyOn(tenantContext, 'getActiveTenantId').mockReturnValue(null)
    const spy = vi.spyOn(reportsApi, 'getNetworkReport')

    renderPage()

    expect(screen.getByTestId('dashboard-kpis')).toBeInTheDocument()
    expect(spy).not.toHaveBeenCalled()
  })
})
