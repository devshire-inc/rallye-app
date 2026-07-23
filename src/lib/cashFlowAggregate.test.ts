import { describe, expect, it } from 'vitest'
import { computeCategoryBreakdown, computeRecebimentos, computeSummary } from './cashFlowAggregate'
import type { InvoiceListItem } from './api/invoices'

function invoice(overrides: Partial<InvoiceListItem>): InvoiceListItem {
  return {
    id: 'id',
    studentId: 'student',
    studentName: 'Aluno Teste',
    sourceType: 'adhoc',
    description: 'desc',
    amount: 100,
    dueDate: '2026-07-10',
    status: 'gerada',
    daysOverdue: null,
    paymentMethod: null,
    paidAt: null,
    ...overrides,
  }
}

describe('computeSummary', () => {
  it('receita soma só faturas pagas', () => {
    const invoices = [
      invoice({ status: 'paga', amount: 300 }),
      invoice({ status: 'gerada', amount: 200 }),
      invoice({ status: 'paga', amount: 50 }),
    ]
    expect(computeSummary(invoices)).toEqual({ receita: 350, despesas: 0, saldo: 350 })
  })

  it('sem faturas, tudo zerado', () => {
    expect(computeSummary([])).toEqual({ receita: 0, despesas: 0, saldo: 0 })
  })
})

describe('computeRecebimentos', () => {
  it('separa recebido/a receber/em atraso corretamente', () => {
    const invoices = [
      invoice({ status: 'paga', amount: 100 }),
      invoice({ status: 'gerada', amount: 50 }),
      invoice({ status: 'enviada', amount: 30 }),
      invoice({ status: 'atrasada', amount: 20 }),
      invoice({ status: 'cancelada', amount: 999 }),
    ]
    expect(computeRecebimentos(invoices)).toEqual({ recebido: 100, aReceber: 80, emAtraso: 20 })
  })
})

describe('computeCategoryBreakdown', () => {
  it('agrupa por source_type, só faturas pagas, ordenado desc', () => {
    const invoices = [
      invoice({ status: 'paga', sourceType: 'subscription', amount: 300 }),
      invoice({ status: 'paga', sourceType: 'adhoc', amount: 500 }),
      invoice({ status: 'gerada', sourceType: 'tournament_entry', amount: 999 }),
      invoice({ status: 'paga', sourceType: 'subscription', amount: 100 }),
    ]
    expect(computeCategoryBreakdown(invoices)).toEqual([
      { sourceType: 'adhoc', label: 'Avulso', amount: 500 },
      { sourceType: 'subscription', label: 'Mensalidades', amount: 400 },
    ])
  })

  it('sem faturas pagas, lista vazia', () => {
    expect(computeCategoryBreakdown([invoice({ status: 'gerada' })])).toEqual([])
  })
})
