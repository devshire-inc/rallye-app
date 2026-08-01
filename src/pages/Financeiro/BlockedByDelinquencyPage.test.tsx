import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as invoicesApi from '../../lib/api/invoices'
import type { InvoiceListItem } from '../../lib/api/invoices'
import { renderWithPermissions } from '../../test/renderWithPermissions'
import BlockedByDelinquencyPage from './BlockedByDelinquencyPage'

afterEach(() => {
  vi.restoreAllMocks()
})

function invoice(overrides: Partial<InvoiceListItem> = {}): InvoiceListItem {
  return {
    id: 'inv-1',
    studentId: 'student-1',
    studentName: 'Aluno Teste',
    sourceType: 'subscription',
    description: 'Mensalidade Fev/2026',
    amount: 315,
    dueDate: '2026-02-10',
    status: 'atrasada',
    daysOverdue: 42,
    paymentMethod: null,
    paidAt: null,
    ...overrides,
  }
}

function renderPage() {
  return renderWithPermissions(
    <MemoryRouter initialEntries={['/units/unit-1/blocked']}>
      <Routes>
        <Route path="/units/:unitId/blocked" element={<BlockedByDelinquencyPage />} />
        <Route path="/invoices/:invoiceId" element={<div>Detalhe da fatura placeholder</div>} />
        <Route path="/units/:unitId/my-invoices" element={<div>Minhas faturas placeholder</div>} />
        <Route path="/units/:unitId/dashboard" element={<div>Dashboard placeholder</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('BlockedByDelinquencyPage — carregamento e erro', () => {
  it('pede ao backend apenas as faturas atrasadas da própria unidade', async () => {
    const listSpy = vi
      .spyOn(invoicesApi, 'listInvoices')
      .mockResolvedValue({ ok: true, invoices: [invoice()], total: 1 })

    renderPage()

    await screen.findByText('Não foi possível concluir')
    expect(listSpy).toHaveBeenCalledWith('unit-1', { status: 'atrasada' })
  })

  it('mostra um alerta quando a listagem falha', async () => {
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue({
      ok: false,
      status: 500,
      error: 'list_invoices_failed',
    })

    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível verificar/i)
  })
})

describe('BlockedByDelinquencyPage — bloqueio ativo', () => {
  it('mostra a data de atraso da fatura MAIS ANTIGA (mesma regra do MIN(due_date) do backend)', async () => {
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue({
      ok: true,
      invoices: [
        invoice({ id: 'inv-2', description: 'Mensalidade Mar/2026', dueDate: '2026-03-10' }),
        invoice({ id: 'inv-1', description: 'Mensalidade Fev/2026', dueDate: '2026-02-10' }),
      ],
      total: 2,
    })

    renderPage()

    expect(
      await screen.findByText(/em atraso desde 10\/02\/2026\. Regularize para voltar a agendar/i),
    ).toBeInTheDocument()
    expect(screen.getByText('Mensalidade Fev/2026')).toBeInTheDocument()
  })

  it('mostra valor e dias de atraso no card de dívida', async () => {
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue({
      ok: true,
      invoices: [invoice()],
      total: 1,
    })

    renderPage()

    expect(await screen.findByText('R$ 315,00 · atraso de 42 dias')).toBeInTheDocument()
  })

  it('abre o detalhe da fatura mais antiga no CTA principal', async () => {
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue({
      ok: true,
      invoices: [invoice()],
      total: 1,
    })

    renderPage()
    await screen.findByText('Não foi possível concluir')

    await userEvent.click(screen.getByRole('button', { name: 'Ver fatura e regularizar' }))

    expect(await screen.findByText('Detalhe da fatura placeholder')).toBeInTheDocument()
  })

  it('explica que não há contato da arena em vez de fabricar um link', async () => {
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue({
      ok: true,
      invoices: [invoice()],
      total: 1,
    })

    renderPage()
    await screen.findByText('Não foi possível concluir')

    await userEvent.click(screen.getByRole('button', { name: 'Falar com a arena' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/ainda não expõe o contato/i)).toBeInTheDocument()
  })

  it('oferece o atalho para todas as faturas só quando há mais de uma em atraso', async () => {
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue({
      ok: true,
      invoices: [invoice(), invoice({ id: 'inv-2', dueDate: '2026-03-10' })],
      total: 2,
    })

    renderPage()

    await userEvent.click(
      await screen.findByRole('button', { name: 'Ver todas as 2 faturas em atraso' }),
    )

    expect(await screen.findByText('Minhas faturas placeholder')).toBeInTheDocument()
  })
})

describe('BlockedByDelinquencyPage — sem fatura atrasada', () => {
  /* O bloqueio é calculado ao vivo pelo backend a partir de invoices
     atrasadas; sem nenhuma, o aluno simplesmente não está bloqueado. */
  it('mostra "tudo em dia" em vez de um bloqueio inventado', async () => {
    vi.spyOn(invoicesApi, 'listInvoices').mockResolvedValue({
      ok: true,
      invoices: [],
      total: 0,
    })

    renderPage()

    expect(await screen.findByText('Tudo em dia!')).toBeInTheDocument()
    expect(screen.queryByText('Não foi possível concluir')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Voltar ao início' }))
    expect(await screen.findByText('Dashboard placeholder')).toBeInTheDocument()
  })
})
