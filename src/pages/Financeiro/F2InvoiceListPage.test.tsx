import { screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as invoicesApi from '../../lib/api/invoices'
import type { InvoiceListItem, InvoiceStatus, ListInvoicesResult } from '../../lib/api/invoices'
import { STATUS_LABEL } from '../../lib/invoiceStatus'
import { renderWithPermissions } from '../../test/renderWithPermissions'
import F2InvoiceListPage from './F2InvoiceListPage'

afterEach(() => {
  vi.restoreAllMocks()
})

const ALL_STATUSES: InvoiceStatus[] = [
  'gerada',
  'enviada',
  'paga',
  'atrasada',
  'cancelada',
  'estornada',
]

function invoice(status: InvoiceStatus): InvoiceListItem {
  return {
    id: `inv-${status}`,
    studentId: `student-${status}`,
    studentName: 'Aluno Teste',
    sourceType: 'subscription',
    description: 'Mensalidade',
    amount: 200,
    dueDate: '2026-07-10',
    status,
    daysOverdue: status === 'atrasada' ? 5 : null,
    paymentMethod: null,
    paidAt: status === 'paga' ? '2026-07-05' : null,
  }
}

function invoicesOk(invoices: InvoiceListItem[]): ListInvoicesResult {
  return { ok: true, invoices, total: invoices.length }
}

function renderPage() {
  return renderWithPermissions(
    <MemoryRouter initialEntries={['/units/unit-1/invoices']}>
      <Routes>
        <Route path="/units/:unitId/invoices" element={<F2InvoiceListPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('F2InvoiceListPage — rótulo de texto de status sempre visível (BEAC-2083)', () => {
  it.each(ALL_STATUSES)(
    'shows the text label for status "%s", not just the badge color',
    async (status) => {
      vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue(invoicesOk([invoice(status)]))

      renderPage()

      const row = await screen.findByTestId(`invoice-row-inv-${status}`)
      expect(within(row).getByText(STATUS_LABEL[status], { exact: false })).toBeInTheDocument()
    },
  )
})
