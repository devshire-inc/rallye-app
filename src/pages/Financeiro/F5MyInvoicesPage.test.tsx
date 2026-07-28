import { fireEvent, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as invoicesApi from '../../lib/api/invoices'
import type { InvoiceListItem, ListInvoicesResult } from '../../lib/api/invoices'
import { renderWithPermissions } from '../../test/renderWithPermissions'
import F5MyInvoicesPage from './F5MyInvoicesPage'

afterEach(() => {
  vi.restoreAllMocks()
})

function invoice(overrides: Partial<InvoiceListItem> = {}): InvoiceListItem {
  return {
    id: 'inv-1',
    studentId: 'student-1',
    studentName: 'Aluno Teste',
    sourceType: 'subscription',
    description: 'Mensalidade julho',
    amount: 200,
    dueDate: '2026-08-10',
    status: 'gerada',
    daysOverdue: null,
    paymentMethod: null,
    paidAt: null,
    ...overrides,
  }
}

function invoicesOk(invoices: InvoiceListItem[]): ListInvoicesResult {
  return { ok: true, invoices, total: invoices.length }
}

function renderPage() {
  return renderWithPermissions(
    <MemoryRouter initialEntries={['/units/unit-1/my-invoices']}>
      <Routes>
        <Route path="/units/:unitId/my-invoices" element={<F5MyInvoicesPage />} />
        <Route path="/invoices/:invoiceId" element={<div>Detalhe da fatura placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('F5MyInvoicesPage — estados de carregamento/erro', () => {
  it('shows a loading status while invoices are being fetched', () => {
    vi.spyOn(invoicesApi, 'listInvoices').mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error message when the fetch fails', async () => {
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'unknown_error',
    })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i)
  })
})

describe('F5MyInvoicesPage — aba Abertas (default)', () => {
  it('shows the empty state when there are no open invoices', async () => {
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue(
      invoicesOk([invoice({ status: 'paga' })]),
    )

    renderPage()

    expect(await screen.findByText(/nenhuma fatura pendente/i)).toBeInTheDocument()
  })

  it('groups overdue and pending invoices under separate headers', async () => {
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue(
      invoicesOk([
        invoice({
          id: 'inv-atrasada',
          status: 'atrasada',
          daysOverdue: 5,
          description: 'Mensalidade junho',
        }),
        invoice({ id: 'inv-pendente', status: 'gerada', description: 'Mensalidade julho' }),
      ]),
    )

    renderPage()

    expect(await screen.findByText('🔴 Atrasada')).toBeInTheDocument()
    expect(screen.getByText('🟡 Pendente')).toBeInTheDocument()
    expect(screen.getByText('Mensalidade junho')).toBeInTheDocument()
    expect(screen.getByText('Mensalidade julho')).toBeInTheDocument()
  })

  it('navigates to the invoice detail page when "PAGAR AGORA" is clicked', async () => {
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue(
      invoicesOk([invoice({ id: 'inv-1', status: 'gerada' })]),
    )

    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'PAGAR AGORA' }))

    expect(await screen.findByText('Detalhe da fatura placeholder')).toBeInTheDocument()
  })
})

describe('F5MyInvoicesPage — aba Pagas', () => {
  it('switches to Pagas and lists paid invoices with their payment method badge', async () => {
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue(
      invoicesOk([
        invoice({
          id: 'inv-paga',
          status: 'paga',
          description: 'Mensalidade maio',
          paymentMethod: 'pix',
          paidAt: '2026-06-01',
        }),
      ]),
    )

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Pagas' }))

    expect(await screen.findByText('Mensalidade maio')).toBeInTheDocument()
    expect(screen.getByText(/pix/i)).toBeInTheDocument()
  })

  it('shows the empty state when there are no paid invoices', async () => {
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue(invoicesOk([]))

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Pagas' }))

    expect(await screen.findByText(/nenhum pagamento registrado/i)).toBeInTheDocument()
  })

  it('navigates to the invoice detail page when a paid invoice row is clicked', async () => {
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue(
      invoicesOk([invoice({ id: 'inv-paga', status: 'paga', description: 'Mensalidade maio' })]),
    )

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Pagas' }))
    fireEvent.click(await screen.findByText('Mensalidade maio'))

    expect(await screen.findByText('Detalhe da fatura placeholder')).toBeInTheDocument()
  })
})
