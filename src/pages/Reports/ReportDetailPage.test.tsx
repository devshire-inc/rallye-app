import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as reportsApi from '../../lib/api/reports'
import type { Report, ReportType } from '../../lib/api/reports'
import * as tenantContext from '../../lib/tenantContext'
import ReportDetailPage from './ReportDetailPage'

afterEach(() => {
  vi.restoreAllMocks()
})

function report(overrides: Partial<Report> = {}): Report {
  return {
    type: 'receita-por-professor',
    period: '2026-03',
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

function renderPage(type: ReportType, unitId = 'unit-1', query = '') {
  return render(
    <MemoryRouter initialEntries={[`/units/${unitId}/reports/${type}${query}`]}>
      <Routes>
        <Route path="/units/:unitId/reports" element={<div>Hub placeholder</div>} />
        <Route path="/units/:unitId/reports/:type" element={<ReportDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ReportDetailPage — loading and error', () => {
  it('shows a loading status while the report is being fetched', () => {
    vi.spyOn(reportsApi, 'getReport').mockReturnValue(new Promise(() => {}))

    renderPage('receita-por-professor')

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error message when the fetch fails', async () => {
    vi.spyOn(reportsApi, 'getReport').mockResolvedValue({ ok: false, status: 500, error: 'x' })

    renderPage('receita-por-professor')

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
  })

  it('shows an error message for an unknown report type without calling the API', () => {
    const spy = vi.spyOn(reportsApi, 'getReport')

    renderPage('relatorio-inexistente' as ReportType)

    expect(screen.getByRole('alert')).toHaveTextContent(/relatório desconhecido/i)
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('ReportDetailPage — receita-por-professor (dados reais)', () => {
  it('renders the chart bars, the table rows and the total row', async () => {
    vi.spyOn(reportsApi, 'getReport').mockResolvedValue({
      ok: true,
      report: report({
        totalAmount: 250,
        totalClassesCount: 2,
        teacherRevenue: [
          { teacherId: 't-1', teacherName: 'Carla Professora', classesCount: 2, amount: 250 },
        ],
      }),
    })

    renderPage('receita-por-professor')

    expect(await screen.findByText('Carla Professora')).toBeInTheDocument()
    expect(screen.getByText('R$ 250,00')).toBeInTheDocument()
    expect(screen.getByLabelText('Carla Professora: R$ 250,00')).toBeInTheDocument()
    expect(screen.getByText('Total')).toBeInTheDocument()
  })

  it('refetches with the new period when the period filter changes', async () => {
    const spy = vi.spyOn(reportsApi, 'getReport').mockResolvedValue({ ok: true, report: report() })

    renderPage('receita-por-professor')
    await screen.findByText(/nenhum dado para este período/i)

    // input[type="month"]: userEvent.type() simula digitação segmentada de
    // data e não é confiável em jsdom para este tipo de input — fireEvent
    // .change (que só dispara o evento `change` com o value final) é a
    // forma recomendada da própria testing-library para date/month inputs.
    fireEvent.change(screen.getByLabelText('Período'), { target: { value: '2026-01' } })

    expect(spy).toHaveBeenLastCalledWith('unit-1', 'receita-por-professor', '2026-01')
  })
})

describe('ReportDetailPage — fluxo-de-caixa (BEAC-1710 desbloqueado)', () => {
  it('renders the receita/despesas/saldo KPIs and the category breakdown table', async () => {
    vi.spyOn(reportsApi, 'getReport').mockResolvedValue({
      ok: true,
      report: report({
        type: 'fluxo-de-caixa',
        cashFlow: {
          summary: {
            receita: 350,
            despesas: 0,
            saldo: 350,
            recebido: 350,
            aReceber: 100,
            emAtraso: 80,
          },
          categories: [
            { sourceType: 'subscription', amount: 300 },
            { sourceType: 'adhoc', amount: 50 },
          ],
        },
      }),
    })

    renderPage('fluxo-de-caixa')

    // Receita, Saldo e Recebido são todos 350 nesta fixture — 3 KPI cards
    // mostram "R$ 350,00" (findAllByText, não findByText).
    expect((await screen.findAllByText('R$ 350,00')).length).toBeGreaterThanOrEqual(3)
    expect(screen.getAllByText('R$ 50,00').length).toBeGreaterThan(0)
    expect(screen.getByText(/mensalidades/i)).toBeInTheDocument()
    expect(screen.getByText(/avulso/i)).toBeInTheDocument()
  })
})

describe('ReportDetailPage — inadimplencia (BEAC-1710 desbloqueado)', () => {
  it('renders the "dias de atraso" filter, the student table and a disabled mass-reminder button', async () => {
    const spy = vi.spyOn(reportsApi, 'getReport').mockResolvedValue({
      ok: true,
      report: report({
        type: 'inadimplencia',
        delinquency: {
          summary: { totalAmount: 445, studentsCount: 2 },
          items: [
            { studentId: 's-carlos', studentName: 'Carlos', amount: 345, daysOverdue: 40 },
            { studentId: 's-ana', studentName: 'Ana', amount: 100, daysOverdue: 10 },
          ],
        },
      }),
    })

    renderPage('inadimplencia')

    expect(await screen.findByLabelText('Dias de atraso')).toBeInTheDocument()
    expect(await screen.findByText('Carlos')).toBeInTheDocument()
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('R$ 445,00')).toBeInTheDocument()

    const button = screen.getByRole('button', { name: 'ENVIAR LEMBRETE EM MASSA' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', expect.stringMatching(/não implementado/i))

    // O filtro inicial (dropdown começa em "7") já é enviado na 1ª busca.
    expect(spy).toHaveBeenLastCalledWith('unit-1', 'inadimplencia', expect.any(String), {
      diasAtraso: '7',
    })
  })

  it('refetches with the new dias_atraso threshold when the filter changes', async () => {
    const spy = vi.spyOn(reportsApi, 'getReport').mockResolvedValue({
      ok: true,
      report: report({
        type: 'inadimplencia',
        delinquency: { summary: { totalAmount: 0, studentsCount: 0 }, items: [] },
      }),
    })

    renderPage('inadimplencia')
    await screen.findByLabelText('Dias de atraso')

    fireEvent.change(screen.getByLabelText('Dias de atraso'), { target: { value: '30' } })

    expect(spy).toHaveBeenLastCalledWith('unit-1', 'inadimplencia', expect.any(String), {
      diasAtraso: '30',
    })
  })

  it('does not render the "dias de atraso" filter for other report types', async () => {
    vi.spyOn(reportsApi, 'getReport').mockResolvedValue({ ok: true, report: report() })

    renderPage('receita-por-professor')
    await screen.findByText(/nenhum dado para este período/i)

    expect(screen.queryByLabelText('Dias de atraso')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'ENVIAR LEMBRETE EM MASSA' }),
    ).not.toBeInTheDocument()
  })
})

describe('ReportDetailPage — receita-por-esporte (BEAC-1710 desbloqueado)', () => {
  it('renders a row per sport and labels the null bucket as "Outros"', async () => {
    vi.spyOn(reportsApi, 'getReport').mockResolvedValue({
      ok: true,
      report: report({
        type: 'receita-por-esporte',
        revenueBySport: {
          summary: { totalAmount: 360 },
          items: [
            { sport: 'beach_tennis', amount: 300 },
            { sport: null, amount: 60 },
          ],
        },
      }),
    })

    renderPage('receita-por-esporte')

    expect(await screen.findByText(/beach tennis/i)).toBeInTheDocument()
    expect(screen.getByText('Outros')).toBeInTheDocument()
    expect(screen.getByText('R$ 300,00')).toBeInTheDocument()
    expect(screen.getByText('R$ 60,00')).toBeInTheDocument()
  })
})

describe('ReportDetailPage — dre (BEAC-1710 desbloqueado)', () => {
  it('renders the Receita/Despesas/Resultado rows', async () => {
    vi.spyOn(reportsApi, 'getReport').mockResolvedValue({
      ok: true,
      report: report({
        type: 'dre',
        dre: {
          summary: { receita: 500, despesas: 0, resultado: 500 },
          items: [
            { label: 'Receita', amount: 500 },
            { label: 'Despesas', amount: 0 },
            { label: 'Resultado', amount: 500 },
          ],
        },
      }),
    })

    renderPage('dre')

    expect(await screen.findByText('Receita')).toBeInTheDocument()
    expect(screen.getByText('Despesas')).toBeInTheDocument()
    expect(screen.getByText('Resultado')).toBeInTheDocument()
    expect(screen.getAllByText('R$ 500,00').length).toBeGreaterThan(0)
  })
})

describe('ReportDetailPage — day-use (BEAC-1710 desbloqueado)', () => {
  it('renders the "esporte" filter and a row per quadra', async () => {
    const spy = vi.spyOn(reportsApi, 'getReport').mockResolvedValue({
      ok: true,
      report: report({
        type: 'day-use',
        dayUse: {
          summary: { totalBookings: 5, estimatedRevenue: 260 },
          items: [
            {
              courtId: 'c-1',
              courtName: 'Quadra BT',
              sport: 'beach_tennis',
              bookingsCount: 3,
              estimatedRevenue: 180,
            },
            {
              courtId: 'c-2',
              courtName: 'Quadra Padel',
              sport: 'padel',
              bookingsCount: 2,
              estimatedRevenue: 80,
            },
          ],
        },
      }),
    })

    renderPage('day-use')

    expect(await screen.findByLabelText('Esporte')).toBeInTheDocument()
    expect(screen.getByText('Quadra BT')).toBeInTheDocument()
    expect(screen.getByText('Quadra Padel')).toBeInTheDocument()
    // Regression guard (Reviewer note, BEAC-1967 round 2): day-use revenue is
    // an estimate (bookings × configured price), never settled invoice
    // income — the label must stay "Receita estimada", not silently drift
    // back to a bare "Receita" that could be misread as real revenue.
    expect(screen.getAllByText('Receita estimada').length).toBeGreaterThan(0)

    fireEvent.change(screen.getByLabelText('Esporte'), { target: { value: 'padel' } })
    expect(spy).toHaveBeenLastCalledWith('unit-1', 'day-use', expect.any(String), {
      esporte: 'padel',
    })
  })
})

describe('ReportDetailPage — relatórios indisponíveis (dependência não resolvida)', () => {
  it('renders an "Indisponível" banner with the backend reason, not fabricated data', async () => {
    vi.spyOn(reportsApi, 'getReport').mockResolvedValue({
      ok: true,
      report: report({
        type: 'fluxo-de-caixa',
        available: false,
        reason: 'Depende de uma dependência ainda não resolvida.',
      }),
    })

    renderPage('fluxo-de-caixa')

    expect(await screen.findByText(/indisponível/i)).toBeInTheDocument()
    expect(screen.getByText(/depende de uma dependência/i)).toBeInTheDocument()
  })
})

describe('ReportDetailPage — relatórios vazios (Épico 9)', () => {
  it('renders an empty-state banner (not "Indisponível") for vendas-loja', async () => {
    vi.spyOn(reportsApi, 'getReport').mockResolvedValue({
      ok: true,
      report: report({
        type: 'vendas-loja',
        available: true,
        reason: 'Loja (Épico 9) ainda não planejada — sem fonte de dados de vendas.',
      }),
    })

    renderPage('vendas-loja')

    expect(await screen.findByText(/loja \(épico 9\)/i)).toBeInTheDocument()
    expect(screen.queryByText(/^indisponível\.?$/i)).not.toBeInTheDocument()
  })
})

describe('ReportDetailPage — exportação (pós-MVP)', () => {
  it('renders a disabled export button with an explanatory title', async () => {
    vi.spyOn(reportsApi, 'getReport').mockResolvedValue({ ok: true, report: report() })

    renderPage('receita-por-professor')
    await screen.findByText(/nenhum dado para este período/i)

    const button = screen.getByRole('button', { name: 'Exportar (PDF/CSV)' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('title', expect.stringMatching(/pós-mvp/i))
  })
})

// BEAC-1970: "Todas" (?scope=network) chama GET /tenants/{tenantId}/reports/{type}
// (getNetworkReport) em vez de GET /units/{unitId}/reports/{type}, com o
// MESMO envelope de resposta — os render* já testados acima não mudam.
describe('ReportDetailPage — visão de rede / "Todas" (BEAC-1970)', () => {
  it('calls getNetworkReport with the active tenantId (not getReport) when ?scope=network is present', async () => {
    vi.spyOn(tenantContext, 'getActiveTenantId').mockReturnValue('tenant-1')
    const networkSpy = vi.spyOn(reportsApi, 'getNetworkReport').mockResolvedValue({
      ok: true,
      report: report({
        type: 'fluxo-de-caixa',
        cashFlow: {
          summary: {
            receita: 750,
            despesas: 0,
            saldo: 750,
            recebido: 750,
            aReceber: 0,
            emAtraso: 0,
          },
          categories: [],
        },
      }),
    })
    const unitSpy = vi.spyOn(reportsApi, 'getReport')

    renderPage('fluxo-de-caixa', 'unit-1', '?scope=network')

    expect((await screen.findAllByText('R$ 750,00')).length).toBeGreaterThan(0)
    expect(networkSpy).toHaveBeenLastCalledWith('tenant-1', 'fluxo-de-caixa', expect.any(String))
    expect(unitSpy).not.toHaveBeenCalled()
  })

  it('without ?scope=network, keeps calling getReport (per-unit) — unaffected default behavior', async () => {
    const networkSpy = vi.spyOn(reportsApi, 'getNetworkReport')
    vi.spyOn(reportsApi, 'getReport').mockResolvedValue({ ok: true, report: report() })

    renderPage('receita-por-professor')
    await screen.findByText(/nenhum dado para este período/i)

    expect(networkSpy).not.toHaveBeenCalled()
  })

  it('shows the error state instead of hanging when ?scope=network is present but no active tenant is known', async () => {
    vi.spyOn(tenantContext, 'getActiveTenantId').mockReturnValue(null)
    const networkSpy = vi.spyOn(reportsApi, 'getNetworkReport')

    renderPage('fluxo-de-caixa', 'unit-1', '?scope=network')

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
    expect(networkSpy).not.toHaveBeenCalled()
  })

  it('the back link preserves ?scope=network', async () => {
    vi.spyOn(tenantContext, 'getActiveTenantId').mockReturnValue('tenant-1')
    vi.spyOn(reportsApi, 'getNetworkReport').mockResolvedValue({ ok: true, report: report() })

    renderPage('receita-por-professor', 'unit-1', '?scope=network')
    await screen.findByText(/nenhum dado para este período/i)

    expect(screen.getByRole('link', { name: '‹ Relatórios' })).toHaveAttribute(
      'href',
      '/units/unit-1/reports?scope=network',
    )
  })

  it('still passes the inadimplencia dias_atraso filter through to getNetworkReport', async () => {
    vi.spyOn(tenantContext, 'getActiveTenantId').mockReturnValue('tenant-1')
    const networkSpy = vi.spyOn(reportsApi, 'getNetworkReport').mockResolvedValue({
      ok: true,
      report: report({
        type: 'inadimplencia',
        delinquency: { summary: { totalAmount: 0, studentsCount: 0 }, items: [] },
      }),
    })

    renderPage('inadimplencia', 'unit-1', '?scope=network')
    await screen.findByLabelText('Dias de atraso')

    expect(networkSpy).toHaveBeenLastCalledWith('tenant-1', 'inadimplencia', expect.any(String), {
      diasAtraso: '7',
    })
  })
})
