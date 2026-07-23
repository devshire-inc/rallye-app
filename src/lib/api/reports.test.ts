import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}))

vi.mock('../httpClient', () => ({
  apiFetch: apiFetchMock,
}))

import { getNetworkReport, getReport } from './reports'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getReport — receita-por-professor (formato pré-existente)', () => {
  it('maps summary/items to totalAmount/totalClassesCount/teacherRevenue', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        type: 'receita-por-professor',
        period: '2026-03',
        available: true,
        summary: { total_amount: 250, total_classes_count: 2 },
        items: [{ teacher_id: 't-1', teacher_name: 'Carla', classes_count: 2, amount: 250 }],
      }),
    )

    const result = await getReport('unit-1', 'receita-por-professor', '2026-03')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.report.totalAmount).toBe(250)
    expect(result.report.totalClassesCount).toBe(2)
    expect(result.report.teacherRevenue).toEqual([
      { teacherId: 't-1', teacherName: 'Carla', classesCount: 2, amount: 250 },
    ])
    expect(result.report.cashFlow).toBeNull()
  })
})

describe('getReport — fluxo-de-caixa', () => {
  it('maps summary/items to the cashFlow shape', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        type: 'fluxo-de-caixa',
        period: '2026-03',
        available: true,
        summary: {
          receita: 350,
          despesas: 0,
          saldo: 350,
          recebido: 350,
          a_receber: 100,
          em_atraso: 80,
        },
        items: [
          { source_type: 'subscription', amount: 300 },
          { source_type: 'adhoc', amount: 50 },
        ],
      }),
    )

    const result = await getReport('unit-1', 'fluxo-de-caixa', '2026-03')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.report.cashFlow).toEqual({
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
    })
    expect(result.report.teacherRevenue).toEqual([])
  })
})

describe('getReport — inadimplencia', () => {
  it('maps summary/items to the delinquency shape', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        type: 'inadimplencia',
        period: '2026-03',
        available: true,
        summary: { total_amount: 445, students_count: 2 },
        items: [
          { student_id: 's-carlos', student_name: 'Carlos', amount: 345, days_overdue: 40 },
          { student_id: 's-ana', student_name: 'Ana', amount: 100, days_overdue: 10 },
        ],
      }),
    )

    const result = await getReport('unit-1', 'inadimplencia', '2026-03')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.report.delinquency).toEqual({
      summary: { totalAmount: 445, studentsCount: 2 },
      items: [
        { studentId: 's-carlos', studentName: 'Carlos', amount: 345, daysOverdue: 40 },
        { studentId: 's-ana', studentName: 'Ana', amount: 100, daysOverdue: 10 },
      ],
    })
  })
})

describe('getReport — receita-por-esporte', () => {
  it('maps summary/items to the revenueBySport shape, preserving sport=null', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        type: 'receita-por-esporte',
        period: '2026-03',
        available: true,
        summary: { total_amount: 360 },
        items: [
          { sport: 'beach_tennis', amount: 300 },
          { sport: null, amount: 60 },
        ],
      }),
    )

    const result = await getReport('unit-1', 'receita-por-esporte', '2026-03')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.report.revenueBySport).toEqual({
      summary: { totalAmount: 360 },
      items: [
        { sport: 'beach_tennis', amount: 300 },
        { sport: null, amount: 60 },
      ],
    })
  })
})

describe('getReport — dre', () => {
  it('maps summary/items to the dre shape', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        type: 'dre',
        period: '2026-03',
        available: true,
        summary: { receita: 500, despesas: 0, resultado: 500 },
        items: [
          { label: 'Receita', amount: 500 },
          { label: 'Despesas', amount: 0 },
          { label: 'Resultado', amount: 500 },
        ],
      }),
    )

    const result = await getReport('unit-1', 'dre', '2026-03')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.report.dre).toEqual({
      summary: { receita: 500, despesas: 0, resultado: 500 },
      items: [
        { label: 'Receita', amount: 500 },
        { label: 'Despesas', amount: 0 },
        { label: 'Resultado', amount: 500 },
      ],
    })
  })
})

describe('getReport — day-use', () => {
  it('maps summary/items to the dayUse shape', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        type: 'day-use',
        period: '2026-03',
        available: true,
        summary: { total_bookings: 5, estimated_revenue: 260 },
        items: [
          {
            court_id: 'c-1',
            court_name: 'Quadra BT',
            sport: 'beach_tennis',
            bookings_count: 3,
            estimated_revenue: 180,
          },
        ],
      }),
    )

    const result = await getReport('unit-1', 'day-use', '2026-03')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.report.dayUse).toEqual({
      summary: { totalBookings: 5, estimatedRevenue: 260 },
      items: [
        {
          courtId: 'c-1',
          courtName: 'Quadra BT',
          sport: 'beach_tennis',
          bookingsCount: 3,
          estimatedRevenue: 180,
        },
      ],
    })
  })
})

describe('getReport — relatório indisponível/vazio (sem summary/items)', () => {
  it('leaves every typed shape null when the backend omits summary/items', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        type: 'fluxo-de-caixa',
        period: '2026-03',
        available: false,
        reason: 'x',
      }),
    )

    const result = await getReport('unit-1', 'fluxo-de-caixa', '2026-03')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.report.cashFlow).toBeNull()
    expect(result.report.delinquency).toBeNull()
    expect(result.report.revenueBySport).toBeNull()
    expect(result.report.dre).toBeNull()
    expect(result.report.dayUse).toBeNull()
  })
})

// BEAC-1970 (F1/F7 — filtro de unit/"Todas" para Tenant Owner): getNetworkReport
// consome GET /tenants/{id}/reports/{type}, o endpoint de rede de BEAC-1969 —
// mesmo envelope JSON do endpoint por-unit (network.go reusa a mesma struct
// Response), então só a URL muda; a conversão fromWire é a mesma já provada
// acima por getReport.
describe('getNetworkReport — GET /tenants/{id}/reports/{type}', () => {
  it('calls the tenant-scoped route (not the unit-scoped one) with the period query param', async () => {
    apiFetchMock.mockResolvedValue(
      jsonResponse(200, {
        type: 'fluxo-de-caixa',
        period: '2026-03',
        available: true,
        summary: {
          receita: 750,
          despesas: 0,
          saldo: 750,
          recebido: 750,
          a_receber: 0,
          em_atraso: 0,
        },
        items: [],
      }),
    )

    const result = await getNetworkReport('tenant-1', 'fluxo-de-caixa', '2026-03')

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/tenants/tenant-1/reports/fluxo-de-caixa?period=2026-03',
    )
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.report.cashFlow?.summary.receita).toBe(750)
  })

  it('propagates a failure (e.g. 403 for a non-Tenant-Owner) as ApiFailure', async () => {
    apiFetchMock.mockResolvedValue(jsonResponse(403, { error: 'forbidden' }))

    const result = await getNetworkReport('tenant-1', 'fluxo-de-caixa')

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.status).toBe(403)
  })
})
